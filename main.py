from flask import Flask, render_template, url_for, request, redirect, flash, session, jsonify
import sqlite3
from database_wrapper import UserDB
import hashlib
from datetime import datetime
from flask_login import LoginManager, login_user, current_user, logout_user, login_required
from user_auth import *
import json
import os 
from werkzeug.utils import secure_filename


app = Flask(__name__)
app.config['SECRET_KEY']='md-sim'
login_manager = LoginManager(app)
login_manager.login_view = 'login'
app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static', 'profile_pics')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

DATABASE = 'userdata.db'

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
           
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

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
    if request.method == "POST":
        # Handle form submission
        username = request.form.get('username')
        picture = request.files.get('picture')
        
        # Validate username
        if username and username != current_user.username:
            # Check if username is already taken
            conn = get_db_connection()
            existing_user = conn.execute('SELECT id FROM users WHERE username = ? AND id != ?', 
                                       (username, current_user.id)).fetchone()
            conn.close()
            
            if existing_user:
                flash('Username already taken. Please choose another.', 'error')
            else:
                # Update username in database
                conn = get_db_connection()
                conn.execute('UPDATE users SET username = ? WHERE id = ?', 
                           (username, current_user.id))
                conn.commit()
                conn.close()
                flash('Username updated successfully!', 'success')
        
        # Handle picture upload
        if picture and picture.filename:
            if allowed_file(picture.filename):
                # Delete old picture if it's not the default
                if current_user.image_file != 'default.jpg':
                    old_pic_path = os.path.join(app.config['UPLOAD_FOLDER'], current_user.image_file)
                    if os.path.exists(old_pic_path):
                        os.remove(old_pic_path)
                
                # Save new picture
                filename = secure_filename(f"user_{current_user.id}.{picture.filename.rsplit('.', 1)[1].lower()}")
                picture.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                
                # Update database
                conn = get_db_connection()
                conn.execute('UPDATE users SET image_file = ? WHERE id = ?', 
                           (filename, current_user.id))
                conn.commit()
                conn.close()
                flash('Profile picture updated successfully!', 'success')
            else:
                flash('Allowed file types are png, jpg, jpeg, gif', 'error')
        
        return redirect(url_for('account'))
    
    image_file = url_for('static', filename='profile_pics/' + current_user.image_file)
    return render_template('account.html', image_file=image_file)

@app.route("/create", methods=["GET"])
def simulation():
    return render_template('simulation.html')


@app.route("/save_post", methods=["POST"])
@login_required
def save_post():
    try:
        data = request.get_json()
        
        # Clean the simulation data
        clean_data = {
            "particles": data.get("particles", []),
            "bonds": data.get("bonds", []),
            "settings": data.get("settings", {})
        }
        
        # Remove any unexpected fields
        clean_data["settings"].pop("created_at", None)
        clean_data["settings"].pop("temperature", None)

        # Save to database
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO posts (title, description, particle_data, user_id)
            VALUES (?, ?, ?, ?)
        ''', (
            data.get("title", "Untitled"),
            data.get("description", ""),
            json.dumps(clean_data, ensure_ascii=False),
            current_user.id
        ))
        conn.commit()
        post_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        conn.close()
        
        return jsonify({"success": True, "post_id": post_id})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    
# View Individual Post (GET)
@app.route("/post/<int:post_id>")
def view_post(post_id):
    conn = get_db_connection()
    try:
        query = '''
            SELECT 
                posts.id,
                posts.title,
                posts.description,
                posts.particle_data,
                users.username,
                users.image_file as user_image,
                users.id as user_id
            FROM posts
            JOIN users ON posts.user_id = users.id
            WHERE posts.id = ?
        '''
        post = conn.execute(query, (post_id,)).fetchone()
        if not post:
            print("DEBUG: No post found with id:", post_id)
            return redirect(url_for('home'))

        # Debug print the retrieved post
        print("DEBUG: Post retrieved:", dict(post))

        particle_data = post['particle_data'] or '{}'
        if isinstance(particle_data, bytes):
            particle_data = particle_data.decode('utf-8')

        try:
            data = json.loads(particle_data)
            particles = data.get('particles', [])
            bonds = data.get('bonds', [])
            settings = data.get('settings', {})
        except Exception as e:
            print("DEBUG: Error parsing particle_data:", e)
            particles, bonds, settings = [], [], {}

        return render_template('view_post.html',
                               post=dict(post),
                               particles=particles,
                               bonds=bonds,
                               settings=settings)
    except Exception as e:
        print("DEBUG: Error loading post:", e)
        return redirect(url_for('home'))
    finally:
        conn.close()

           

@app.route("/user/<int:user_id>")
def view_profile(user_id):
    conn = get_db_connection()
    try:
        # Get user info
        user = conn.execute(
            'SELECT id, username, image_file FROM users WHERE id = ?', 
            (user_id,)
        ).fetchone()
        
        if not user:
            flash('User not found', 'error')
            return redirect(url_for('home'))
        
        # Get user's posts
        posts = conn.execute('''
            SELECT posts.id, posts.title, posts.description, 
                   users.username, users.image_file as user_image
            FROM posts
            JOIN users ON posts.user_id = users.id
            WHERE users.id = ?
            ORDER BY posts.id DESC
        ''', (user_id,)).fetchall()
        
        return render_template(
            'view_profile.html',
            user=dict(user),
            user_posts=[dict(post) for post in posts]
        )
    except Exception as e:
        flash(f'Error loading profile: {str(e)}', 'error')
        return redirect(url_for('home'))
    finally:
        conn.close()

@app.route("/get_user_posts")
@login_required
def get_user_posts():
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify([])
    
    conn = get_db_connection()
    try:
        query = '''
            SELECT posts.id, posts.title, posts.description, 
                   users.username, users.image_file as user_image
            FROM posts
            JOIN users ON posts.user_id = users.id
            WHERE users.id = ?
        '''
        posts = conn.execute(query, (user_id,)).fetchall()
        return jsonify([dict(post) for post in posts])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    app.run(debug=True)