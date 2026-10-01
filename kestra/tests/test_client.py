import importlib.util
from pathlib import Path

import pytest


def client_module():
    path = Path(__file__).resolve().parents[2] / "scripts/kestra.py"
    assert path.exists(), "Missing Kestra API client"
    spec = importlib.util.spec_from_file_location("kestra_client", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_wait_returns_success():
    module = client_module()
    states = iter([{"state": {"current": "RUNNING"}}, {"state": {"current": "SUCCESS"}}])
    result = module.wait_execution(lambda: next(states), timeout=1, interval=0)
    assert result["state"]["current"] == "SUCCESS"


@pytest.mark.parametrize("state", ["FAILED", "KILLED", "CANCELLED", "WARNING"])
def test_wait_rejects_unsuccessful_execution(state):
    module = client_module()
    with pytest.raises(RuntimeError, match=state):
        module.wait_execution(lambda: {"state": {"current": state}}, timeout=1, interval=0)


def test_wait_times_out():
    module = client_module()
    with pytest.raises(TimeoutError):
        module.wait_execution(lambda: {"state": {"current": "RUNNING"}}, timeout=0, interval=0)
