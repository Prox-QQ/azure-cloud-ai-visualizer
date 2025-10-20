"""
Package initializer for backend.app

Provides a small compatibility shim that re-exports `prepare_function_call_results`
from `agent_framework.openai._shared` onto the top-level `agent_framework` module
when the installed versions place the helper in a submodule. This avoids import
errors during local development and tests when package versions are mismatched.
"""
import importlib
import warnings

try:
    af_shared = importlib.import_module("agent_framework.openai._shared")
    af_mod = importlib.import_module("agent_framework")
    if not hasattr(af_mod, "prepare_function_call_results") and hasattr(
        af_shared, "prepare_function_call_results"
    ):
        setattr(af_mod, "prepare_function_call_results", af_shared.prepare_function_call_results)
except Exception as _shim_err:  # pragma: no cover - environment-dependent
    warnings.warn(f"agent_framework compatibility shim not applied: {_shim_err}")
