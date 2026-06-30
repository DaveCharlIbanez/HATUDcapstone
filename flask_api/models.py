from datetime import datetime
from typing import TypedDict

class User(TypedDict):
    id: str
    username: str
    email: str
    password_hash: str
    created_at: str

class Post(TypedDict):
    id: str
    title: str
    content: str
    author_id: str
    author_name: str
    created_at: str
    likes: int

class Comment(TypedDict):
    id: str
    post_id: str
    author_id: str
    author_name: str
    content: str
    created_at: str

users_db: dict[str, User] = {}

posts_db: list[Post] = [
    {
        "id": "1",
        "title": "Welcome to HATUD",
        "content": "This is the first post on our platform.",
        "author_id": "1",
        "author_name": "admin",
        "created_at": "2026-06-29T10:00:00Z",
        "likes": 42
    },
    {
        "id": "2",
        "title": "Features Overview",
        "content": "Check out all the amazing features we have.",
        "author_id": "1",
        "author_name": "admin",
        "created_at": "2026-06-29T11:00:00Z",
        "likes": 18
    },
    {
        "id": "3",
        "title": "Getting Started Guide",
        "content": "Learn how to get started with HATUD in minutes.",
        "author_id": "2",
        "author_name": "user123",
        "created_at": "2026-06-29T12:00:00Z",
        "likes": 7
    }
]

comments_db: list[Comment] = [
    {
        "id": "1",
        "post_id": "1",
        "author_id": "2",
        "author_name": "user123",
        "content": "Great first post!",
        "created_at": "2026-06-29T10:30:00Z"
    },
    {
        "id": "2",
        "post_id": "1",
        "author_id": "3",
        "author_name": "contributor",
        "content": "Welcome! Glad to be here.",
        "created_at": "2026-06-29T10:45:00Z"
    },
    {
        "id": "3",
        "post_id": "2",
        "author_id": "1",
        "author_name": "admin",
        "content": "More features coming soon!",
        "created_at": "2026-06-29T11:30:00Z"
    }
]