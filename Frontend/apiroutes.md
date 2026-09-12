# User API Routes

## Base Route: `/users`

| Endpoint | Method | Route Parameters | Body Parameters | Bearer Token | Response | Description |
|---|---|---|---|---|---|---|
| `/signup` | `POST` | - | `{ user_name, password, email }` | Not required | `{ success: true, token, data: user }` | Add a new user |
| `/login` | `POST` | - | - | Not required | `{ success: true, token, data: user }` | Log in a user |