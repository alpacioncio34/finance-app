'''
    Cleanup script: deletes everything in the database by calling the API's DELETE endpoints.

    The API must be running (uvicorn app.main:app --reload --port 8000). Then, from backend/:
        python -m app.services.db_cleanup

    Only accounts and categories need deleting, because the endpoints cascade:
        DELETE /accounts/{id}    -> also deletes that account's transactions
        DELETE /categories/{id}  -> also deletes that category's budgets
    The default categories are re-seeded the next time the server starts.
'''
# httpx is the Python counterpart of Spring's RestTemplate (requests would also work)
import httpx

BASE_URL = "http://localhost:8000"

# Order matters: accounts first, so their transactions are gone before categories are deleted
RESOURCES = ["/accounts", "/categories"]


def clean_database(client: httpx.Client) -> None:
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
        clean_database(client)
