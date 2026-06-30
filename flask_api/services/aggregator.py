from models import posts_db, comments_db, users_db

def aggregate_dashboard_data(user_id: str) -> dict:
    user = users_db.get(user_id)

    total_posts = len(posts_db)
    total_comments = len(comments_db)
    total_likes = sum(post["likes"] for post in posts_db)

    user_posts = [p for p in posts_db if p["author_id"] == user_id]
    user_comments = [c for c in comments_db if c["author_id"] == user_id]

    recent_posts = sorted(posts_db, key=lambda x: x["created_at"], reverse=True)[:5]
    recent_comments = sorted(comments_db, key=lambda x: x["created_at"], reverse=True)[:5]

    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        } if user else None,
        "stats": {
            "total_posts": total_posts,
            "total_comments": total_comments,
            "total_likes": total_likes,
            "user_post_count": len(user_posts),
            "user_comment_count": len(user_comments)
        },
        "recent_posts": recent_posts,
        "recent_comments": recent_comments
    }