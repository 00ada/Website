import hashlib

string = "hello"
hashed_string = hashlib.sha256(string.encode()).hexdigest()

print(hashed_string)

