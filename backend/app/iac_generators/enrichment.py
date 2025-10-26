import copy
from typing import Any, Dict, List, Tuple, Set


def _extract_identifier(metadata: Dict[str, Any], keys: List[str]) -> str:
    for key in keys:
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _ensure_list(target: Dict[str, Any], key: str) -> List[Any]:
    if key not in target or not isinstance(target[key], list):
        target[key] = []
    return target[key]


def enrich_diagram_with_governance(diagram: Dict[str, Any] | None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Augment diagram JSON with governance summaries and inferred scopes."""
    if not isinstance(diagram, dict):
        diagram = {}

    data = copy.deepcopy(diagram)
    nodes: List[Dict[str, Any]] = data.setdefault("nodes", [])
    node_lookup: Dict[str, Dict[str, Any]] = {node.get("id"): node for node in nodes if node.get("id")}

    group_nodes: Dict[str, Dict[str, Any]] = {
        node_id: node for node_id, node in node_lookup.items() if node.get("type") == "azure.group"
    }

    group_members: Dict[str, Dict[str, Set[str]]] = {
        group_id: {"services": set(), "groups": set()} for group_id in group_nodes
    }

    resource_scopes: Dict[str, Dict[str, Any]] = {}

    def get_parent_chain(node_id: str) -> List[Dict[str, Any]]:
        chain: List[Dict[str, Any]] = []
        current = node_lookup.get(node_id)
        visited: Set[str] = set()
        while current:
            parent_id = current.get("parentNode")
            if not parent_id or parent_id in visited:
                break
            parent = node_lookup.get(parent_id)
            if not parent:
                break
            chain.append(parent)
            visited.add(parent_id)
            current = parent
        return chain

    # Assign scopes to service nodes based on parent groups and metadata
    for node_id, node in node_lookup.items():
        if node.get("type") == "azure.group":
            continue

        node_data = node.setdefault("data", {})
        node_metadata = node_data.setdefault("metadata", {})
        tags = node_data.get("tags") if isinstance(node_data.get("tags"), dict) else {}

        chain = get_parent_chain(node_id)
        chain_groups = [g for g in chain if g.get("type") == "azure.group"]

        scope_record: Dict[str, Any] = {
            "managementGroups": [],
            "subscriptions": [],
            "policyAssignments": [],
            "roleAssignments": [],
        }

        for group in chain_groups:
            group_id = group.get("id")
            if not group_id:
                continue
            group_data = group.get("data", {}) or {}
            group_type = group_data.get("groupType") or group_data.get("type") or ""
            group_metadata = group_data.get("metadata") if isinstance(group_data.get("metadata"), dict) else {}

            # Track memberships
            group_members.setdefault(group_id, {"services": set(), "groups": set()})
            group_members[group_id]["services"].add(node_id)

            identifier_keys = ["id", "name", "displayName"]

            if group_type == "managementGroup":
                mg_id = _extract_identifier(group_metadata, ["managementGroupId", "name", "displayName", "id"])
                if mg_id:
                    if mg_id not in scope_record["managementGroups"]:
                        scope_record["managementGroups"].append(mg_id)
                    if not node_metadata.get("managementGroupId"):
                        node_metadata["managementGroupId"] = mg_id
                group_members[group_id]["services"].add(node_id)

            elif group_type == "subscription":
                sub_id = _extract_identifier(group_metadata, ["subscriptionId", "id", "name"])
                if sub_id:
                    if sub_id not in scope_record["subscriptions"]:
                        scope_record["subscriptions"].append(sub_id)
                    if not node_metadata.get("subscriptionId"):
                        node_metadata["subscriptionId"] = sub_id
                group_members[group_id]["services"].add(node_id)

            elif group_type == "policyAssignment":
                policy_id = _extract_identifier(group_metadata, ["policyDefinitionId", "policyAssignmentId", "id"])
                assignment = {
                    "policyDefinitionId": policy_id or "",
                    "displayName": group_data.get("label") or group_data.get("title") or "",
                    "scope": group_metadata.get("scope") or "",
                }
                if not any(value for value in assignment.values()):
                    continue
                if assignment not in scope_record["policyAssignments"]:
                    scope_record["policyAssignments"].append(assignment)
                policies_meta = _ensure_list(node_metadata, "policyAssignments")
                if assignment not in policies_meta:
                    policies_meta.append(assignment)

            elif group_type == "roleAssignment":
                role_id = _extract_identifier(group_metadata, ["roleDefinitionId", "roleId", "id", "name"])
                role_assignment = {
                    "roleDefinitionId": role_id or "",
                    "principalId": group_metadata.get("principalId", ""),
                    "principalType": group_metadata.get("principalType", ""),
                    "displayName": group_data.get("label") or group_data.get("title") or "",
                }
                if not any(value for value in role_assignment.values()):
                    continue
                if role_assignment not in scope_record["roleAssignments"]:
                    scope_record["roleAssignments"].append(role_assignment)
                roles_meta = _ensure_list(node_metadata, "roleAssignments")
                if role_assignment not in roles_meta:
                    roles_meta.append(role_assignment)

        # Tag heuristics
        if not node_metadata.get("subscriptionId"):
            tag_subscription = tags.get("subscriptionId") if isinstance(tags, dict) else None
            if isinstance(tag_subscription, str) and tag_subscription.strip():
                node_metadata["subscriptionId"] = tag_subscription.strip()
                if tag_subscription.strip() not in scope_record["subscriptions"]:
                    scope_record["subscriptions"].append(tag_subscription.strip())

        if not node_metadata.get("managementGroupId"):
            tag_mg = tags.get("managementGroupId") if isinstance(tags, dict) else None
            if isinstance(tag_mg, str) and tag_mg.strip():
                node_metadata["managementGroupId"] = tag_mg.strip()
                if tag_mg.strip() not in scope_record["managementGroups"]:
                    scope_record["managementGroups"].append(tag_mg.strip())

        if scope_record["managementGroups"]:
            mg_list = _ensure_list(node_metadata, "managementGroups")
            for mg in scope_record["managementGroups"]:
                if mg not in mg_list and mg:
                    mg_list.append(mg)

        if scope_record["subscriptions"]:
            subs_list = _ensure_list(node_metadata, "subscriptions")
            for sub in scope_record["subscriptions"]:
                if sub not in subs_list and sub:
                    subs_list.append(sub)

        resource_scopes[node_id] = scope_record

    # Track group-to-group relationships
    for group_id, group in group_nodes.items():
        parent_id = group.get("parentNode")
        if parent_id and parent_id in group_nodes:
            group_members[parent_id]["groups"].add(group_id)

    # Build summary
    summary: Dict[str, List[Dict[str, Any]]] = {
        "managementGroups": [],
        "subscriptions": [],
        "landingZones": [],
        "policyAssignments": [],
        "roleAssignments": [],
        "virtualNetworks": [],
    }

    for group_id, group in group_nodes.items():
        data_block = group.get("data", {}) or {}
        group_type = data_block.get("groupType") or data_block.get("type") or ""
        metadata = data_block.get("metadata") if isinstance(data_block.get("metadata"), dict) else {}
        parent_id = group.get("parentNode")

        base_entry = {
            "id": group_id,
            "label": data_block.get("label") or data_block.get("title") or group_id,
            "metadata": metadata,
            "parentId": parent_id,
            "childGroups": sorted(group_members.get(group_id, {}).get("groups", [])),
            "memberServices": sorted(group_members.get(group_id, {}).get("services", [])),
        }

        if group_type == "managementGroup":
            summary["managementGroups"].append(base_entry)
        elif group_type == "subscription":
            summary["subscriptions"].append(base_entry)
        elif group_type == "landingZone":
            summary["landingZones"].append(base_entry)
        elif group_type == "policyAssignment":
            summary["policyAssignments"].append(base_entry)
        elif group_type == "roleAssignment":
            summary["roleAssignments"].append(base_entry)
        elif group_type == "virtualNetwork":
            summary["virtualNetworks"].append(base_entry)

    warnings: List[str] = []

    if not summary["managementGroups"]:
        warnings.append("No management group defined: deployments will lack a governance root scope.")
    if not summary["subscriptions"]:
        warnings.append("No subscription defined: resources may not have an explicit deployment scope.")
    if not summary["landingZones"]:
        warnings.append("No landing zone container detected: consider grouping workload resources into landing zones.")
    if not summary["virtualNetworks"]:
        warnings.append("No virtual network defined: landing zones typically include hub/spoke networking.")

    data.setdefault("metadata", {})
    data["metadata"]["governance_summary"] = summary
    data["metadata"]["resource_scopes"] = resource_scopes

    preflight = {
        "warnings": warnings,
        "governance_summary": summary,
        "resource_scopes": resource_scopes,
    }

    return data, preflight
