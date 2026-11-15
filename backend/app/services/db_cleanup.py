'''
    Cleanup script: deletes everything in the database by calling the API's DELETE endpoints.

    The API must be running (uvicorn app.main:app --reload --port 8000). Then, from backend/:
        CLEANUP_EMAIL=you@example.com CLEANUP_PASSWORD=... python -m app.services.db_cleanup

    The API requires a login, and every user only reaches their own data, so this cleans
    the data of the user you log in as (not the whole database).

    Bank connections go first: deleting one with delete_accounts=true also removes its accounts.

    Only accounts and categories need deleting, because the endpoints cascade:
        DELETE /accounts/{id}    -> also deletes that account's transactions
        DELETE /categories/{id}  -> also deletes that category's budgets
    The default categories are re-seeded the next time the server starts.
'''
# httpx is the Python counterpart of Spring's RestTemplate (requests would also work)
import os

import httpx

BASE_URL = "http://localhost:8000"

# Order matters: accounts first, so their transactions are gone before categories are deleted
RESOURCES = ["/accounts", "/categories"]


def login(client: httpx.Client) -> None:
    creds = {"email": os.environ["CLEANUP_EMAIL"], "password": os.environ["CLEANUP_PASSWORD"]}
    token = client.post("/auth/login", json=creds).raise_for_status().json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"


def clean_database(client: httpx.Client) -> None:
    connections = client.get("/bank/connections").raise_for_status().json()
    for conn in connections:
        client.delete(f"/bank/connections/{conn['id']}", params={"delete_accounts": True}).raise_for_status()
    print(f"/bank/connections: deleted {len(connections)}")
    for path in RESOURCES:
        deleted = clean_resource(client, path)
        print(f"{path}: deleted {deleted}")


def clean_resource(client: httpx.Client, path: str) -> int:
    # 1. GET the list to obtain every id
    items = client.get(path).raise_for_status().json()

    # 2. DELETE each row by id (raise_for_status turns a 404/500 into an exception)
    for item in items:
        client.delete(f"{path}/{item['id']}").raise_for_status()
    return len(items)


if __name__ == "__main__":
    with httpx.Client(base_url=BASE_URL, timeout=10) as client:
        login(client)
        clean_database(client)
