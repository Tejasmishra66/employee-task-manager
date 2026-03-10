import requests

BASE_URL = "http://127.0.0.1:8000"

# 1. Create a new task
create_resp = requests.post(
    f"{BASE_URL}/tasks",
    params={
        "title": "Develop Login Module",
        "description": "Implement secure login with JWT authentication",
        "employee_id": 1,
        "project_id": 101,
    },
)
print("Create Task:", create_resp.json())

task_id = create_resp.json()["id"]

# 2. Start the task
start_resp = requests.post(f"{BASE_URL}/tasks/{task_id}/start")
print("Start Task:", start_resp.json())

# 3. Stop the task
stop_resp = requests.post(f"{BASE_URL}/tasks/{task_id}/stop")
print("Stop Task:", stop_resp.json())

# 4. List all tasks
list_resp = requests.get(f"{BASE_URL}/tasks")
print("List Tasks:", list_resp.json())