import sqlite3
conn = sqlite3.connect("userdata.db")
cursor = conn.cursor()

import sqlite3

class UserDB:
    def __init__(self, db):
        self.db = db
        self.conn = None
        self.register_query = "INSERT INTO users (username, email, password) VALUES (?,?,?)"

    def connect(self):
        try:
            self.conn = sqlite3.connect(self.db)
            print("Connected to database successfully")
        except sqlite3.Error as e:
            print("Error connecting to database:", e)

    def execute_query(self, query, params=None):
        try:
            cursor = self.conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            self.conn.commit()
            print("Query executed successfully")
            return cursor
        except sqlite3.Error as e:
            print("Error executing query:", e)
            return None

    def add_user(self, name, email, password):
        self.execute_query(self.register_query, [name, email, password])
        self.conn.commit()

    def close_connection(self):
        if self.conn:
            self.conn.close()
            print("Database connection closed")
        else:
            print("No active connection to close")