#!/usr/bin/env python3
"""Validate, import and execute the versioned Kestra pipeline using its REST API."""
import argparse
import base64
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def wait_execution(fetch, timeout=1800, interval=2):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        execution = fetch()
        state = execution["state"]["current"]
        if state == "SUCCESS":
            return execution
        if state in {"FAILED", "KILLED", "CANCELLED", "WARNING"}:
            raise RuntimeError(f"Kestra execution ended with {state}: {execution.get('id', '')}")
        time.sleep(interval)
    raise TimeoutError(f"Kestra execution did not finish within {timeout}s")


class Client:
    def __init__(self, url):
        self.base = url.rstrip("/") + "/api/v1/main"

    def request(self, method, path, data=None, content_type="application/x-yaml", raw=False):
        headers = {"Content-Type": content_type}
        username = os.environ.get("KESTRA_API_USER")
        if username:
            token = base64.b64encode(f"{username}:{os.environ['KESTRA_API_PASSWORD']}".encode()).decode()
            headers["Authorization"] = f"Basic {token}"
        request = Request(self.base + path, data=data, headers=headers, method=method)
        with urlopen(request, timeout=30) as response:
            body = response.read()
        return body if raw else json.loads(body)

    def validate(self, source):
        result = self.request("POST", "/flows/validate", source)
        for flow in result:
            if flow.get("constraints") or flow.get("violations"):
                raise ValueError(f"Invalid Kestra flow: {flow}")
        return result

    def import_flow(self, source):
        self.validate(source)
        try:
            self.request("GET", "/flows/nvdatalake/materialize_all")
        except HTTPError as error:
            if error.code != 404:
                raise
            return self.request("POST", "/flows", source)
        return self.request("PUT", "/flows/nvdatalake/materialize_all", source)

    def execute(self, full_refresh=False):
        boundary = "kestra-nvdatalake-inputs"
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"full_refresh\"\r\n\r\n"
            f"{str(full_refresh).lower()}\r\n--{boundary}--\r\n"
        ).encode()
        return self.request("POST", "/executions/nvdatalake/materialize_all", body,
                            f"multipart/form-data; boundary={boundary}")

    def wait(self, execution_id, timeout=1800):
        return wait_execution(lambda: self.request("GET", f"/executions/{execution_id}"), timeout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "import", "run"])
    parser.add_argument("--url", default=os.environ.get("KESTRA_URL", "http://localhost:8082"))
    parser.add_argument("--flow", type=Path,
                        default=Path(__file__).resolve().parents[1] / "kestra/flows/materialize_all.yml")
    parser.add_argument("--full-refresh", action="store_true")
    parser.add_argument("--timeout", type=int, default=1800)
    args = parser.parse_args()
    client = Client(args.url)
    if args.command == "validate":
        print(json.dumps(client.validate(args.flow.read_bytes()), indent=2))
    elif args.command == "import":
        flow = client.import_flow(args.flow.read_bytes())
        print(f"Imported {flow['namespace']}.{flow['id']} revision {flow['revision']}")
    else:
        execution = client.execute(args.full_refresh)
        print(f"Execution: {execution['id']}", flush=True)
        result = client.wait(execution["id"], args.timeout)
        print(f"State: {result['state']['current']}")


if __name__ == "__main__":
    main()
