from flask import Flask, render_template, url_for, request, redirect, flash, session
import sqlite3
from database_wrapper import UserDB
import hashlib
from datetime import datetime
from flask_login import LoginManager, login_user, current_user, logout_user, login_required
from user_auth import *

app = Flask(__name__)
app.config['SECRET_KEY']='md-sim'
login_manager = LoginManager(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)

@app.route("/home", methods=["GET", "POST"])
@app.route("/", methods=["GET", "POST"])
def home():
    return render_template('index.html')


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

@app.route("/simulation", methods=["GET"])
def simulation():
    return render_template('threemd.html')

if __name__ == '__main__':
    app.run(debug=True)