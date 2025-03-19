from flask import Flask, render_template, url_for, request, redirect, flash, session, jsonify
import sqlite3
from database_wrapper import UserDB
import hashlib
from datetime import datetime
from flask_login import LoginManager, login_user, current_user, logout_user, login_required
from user_auth import *
import json



app = Flask(__name__)
app.config['SECRET_KEY']='md-sim'
login_manager = LoginManager(app)
login_manager.login_view = 'login'

DATABASE = 'userdata.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            particle_data TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)

@app.route("/home", methods=["GET", "POST"])
@app.route("/", methods=["GET", "POST"])
def home():
    conn = get_db_connection()
    try:
        # Fetch all posts with user details
        query = '''
            SELECT posts.id, posts.title, posts.description, users.username, users.image_file as user_image
            FROM posts
            JOIN users ON posts.user_id = users.id
        '''
        posts = conn.execute(query).fetchall()
        posts_list = [dict(post) for post in posts]  # Convert to list of dictionaries
    except Exception as e:
        print(f"Error fetching posts: {e}")
        posts_list = []  # Fallback to an empty list if there's an error
    finally:
        conn.close()

    return render_template('index.html', posts=posts_list)


@app.route("/register", methods=["GET", "POST"])
def register():
    #conn = sqlite3.connect("site_db.db")
    #cursor = conn.cursor()
    db = UserDB("userdata.db")
    db.connect()  
    
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    
    if request.method == "POST":
        Rname = request.form.get("Rname")
        Remail = request.form.get("Remail")
        Rpassword = request.form.get("Rpassword")
        
        hashed_password = hashlib.sha256(Rpassword.encode()).hexdigest()
        
        name_check = db.execute_query("SELECT username FROM users WHERE username = ? ", (Rname,))
        email_check = db.execute_query("SELECT email FROM users WHERE username = ? ", (Rname,))
        
        if name_check.fetchone() == None:
            db.add_user(Rname, Remail, hashed_password)
        else:
            flash("Username already in use.")

        if email_check.fetchone() == None:
            db.add_user(Rname, Remail, hashed_password)
        else: 
            flash("Email already in use.")
        
        db.close_connection()
        
    return render_template('register.html')

@app.route("/login", methods=["GET", "POST"])
def login():
    db = UserDB("userdata.db")
    db.connect()
    
    if current_user.is_authenticated:
        return redirect(url_for('home'))

    if request.method == "POST":
        Lemail = request.form.get("Lemail")
        Lpassword = request.form.get("Lpassword")

        if Lemail is None or Lpassword is None:
            flash('Please enter both email and password.', 'error')
            return render_template('login.html')

        hashed_password = hashlib.sha256(Lpassword.encode()).hexdigest()
        
        user = User.get_by_email(Lemail)
        print(user)
        
        if user:
            if hashed_password == user.password:
                login_user(user)
                flash('Login successful!', 'success')
                next_page = request.args.get("next")
                return redirect(next_page) if next_page else redirect(url_for('home'))
            else:
                flash('Incorrect password. Please try again.', 'error')
        else:
            flash('Email not found. Please check your credentials.', 'error')

    return render_template('login.html')

@app.route("/logout", methods=["GET", "POST"])
def logout():
    logout_user()
    return redirect(url_for('home'))

@app.route("/account", methods=["GET", "POST"])
@login_required
def account():
    image_file = (url_for('static', filename='profile_pics/' + current_user.image_file ))
    return render_template('account.html', image_file=image_file)

@app.route("/create", methods=["GET"])
def simulation():
    return render_template('threemd.html')

@app.route("/save_post", methods=["POST"])
@login_required
def save_post():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Authentication required'}), 401
    
    data = request.json
    title = data.get('title')
    description = data.get('description')
    particle_data = data.get('particle_data')

    if not title or not description or not particle_data:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        # Convert particle data to JSON string
        particle_data_json = json.dumps(particle_data)
    except TypeError:
        return jsonify({'error': 'Invalid particle data format'}), 400

    conn = get_db_connection()
    try:
        conn.execute('''
            INSERT INTO posts (title, description, particle_data, user_id)
            VALUES (?, ?, ?, ?)
        ''', (title, description, particle_data_json, current_user.id))
        conn.commit()
        return jsonify({'message': 'Post saved successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route("/get_posts", methods=["GET"])
def get_posts():
    search_query = request.args.get('search', '')

    conn = get_db_connection()
    try:
        # Fetch posts with user details
        query = '''
            SELECT posts.id, posts.title, posts.description, users.username, users.image_file as user_image
            FROM posts
            JOIN users ON posts.user_id = users.id
            WHERE posts.title LIKE ? OR posts.description LIKE ?
        '''
        posts = conn.execute(query, (f'%{search_query}%', f'%{search_query}%')).fetchall()
        conn.close()

        # Convert posts to a list of dictionaries
        posts_list = [dict(post) for post in posts]
        return jsonify(posts_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route("/post/<int:post_id>")
def view_post(post_id):
    conn = get_db_connection()
    try:
        query = '''
            SELECT posts.id, posts.title, posts.description, posts.particle_data, 
                   users.username, users.image_file as user_image
            FROM posts
            JOIN users ON posts.user_id = users.id
            WHERE posts.id = ?
        '''
        post = conn.execute(query, (post_id,)).fetchone()
        
        if not post:
            return "Post not found.", 404

        # Convert to dict and parse JSON
        post_dict = dict(post)
        post_dict['particle_data'] = json.loads(post_dict['particle_data'])

        return render_template('view_post.html', post=post_dict)
    except json.JSONDecodeError:
        return "Invalid particle data in post", 500
    except Exception as e:
        return f"Error loading post: {str(e)}", 500
    finally:
        conn.close()


if __name__ == '__main__':
    app.run(debug=True)