from flask_login import UserMixin
from database_wrapper import *

class User(UserMixin):
    def __init__(self, id, username, email, password, image_file):
        self.id = id
        self.username = username
        self.email = email
        self.password = password
        self.image_file = image_file

    @staticmethod
    def get_by_email(email):
        db = UserDB("userdata.db")
        db.connect()
        user_data = db.execute_query("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        db.close_connection()

        if user_data:
            return User(user_data[0], user_data[1], user_data[2], user_data[3], user_data[4])  # Assuming columns are (id, username, email, password)
        return None

    @staticmethod
    def get(user_id):
        db = UserDB("userdata.db")
        db.connect()
        user_data = db.execute_query("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        db.close_connection()

        if user_data:
            return User(user_data[0], user_data[1], user_data[2], user_data[3], user_data[4])
        return None