import shutil
import subprocess
import tempfile
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def validate_iac_with_cli(format: str, content: str, extra_files: Dict[str, str] | None = None, timeout: int = 30) -> Dict[str, Any]:
    """Run lightweight CLI validations for bicep or terraform when binaries available.

    Returns a dict with flags and any errors/warnings captured.
    """
    res: Dict[str, Any] = {'cli_present': False, 'errors': [], 'warnings': []}
    if format == 'bicep':
        bicep = shutil.which('bicep')
        if not bicep:
            return res
        res['cli_present'] = True
        try:
            with tempfile.NamedTemporaryFile('w', suffix='.bicep', delete=False) as tf:
                tf.write(content)
                tmp_name = tf.name
            proc = subprocess.run([bicep, 'build', tmp_name], capture_output=True, text=True, timeout=timeout)
            if proc.returncode != 0:
                res['errors'].append(proc.stderr or proc.stdout)
            else:
                if proc.stdout:
                    res['warnings'].append(proc.stdout)
        except Exception as e:
            res['errors'].append(str(e))

    elif format == 'terraform':
        tf = shutil.which('terraform')
        if not tf:
            return res
        res['cli_present'] = True
        try:
            with tempfile.TemporaryDirectory() as td:
                main_tf = f"{td}/main.tf"
                with open(main_tf, 'w') as mf:
                    mf.write(content)
                if extra_files:
                    for name, body in extra_files.items():
                        with open(f"{td}/{name}", 'w') as ef:
                            ef.write(body)
                proc = subprocess.run([tf, 'fmt', '-check', td], capture_output=True, text=True, timeout=20)
                if proc.returncode != 0:
                    res['warnings'].append(proc.stdout or proc.stderr)
        except Exception as e:
            res['errors'].append(str(e))

    return res
