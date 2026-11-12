from flask import Flask, request, jsonify
from flask_cors import CORS  # 👈 add this
import pickle
import string
import nltk
from pathlib import Path
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# NLTK downloads
nltk.download('punkt')
nltk.download('wordnet')
nltk.download('stopwords')

app = Flask(__name__)
CORS(app)  # 👈 add this
lemmatizer = WordNetLemmatizer()
stop_words = set(stopwords.words("english"))


def clean_text(text):
    text = text.lower()
    text = text.translate(str.maketrans('', '', string.punctuation))
    tokens = text.split()
    tokens = [lemmatizer.lemmatize(word) for word in tokens if word not in stop_words]
    return " ".join(tokens)

# Load model relative to this file so the API works from any working directory.
model_path = Path(__file__).resolve().parent.parent / "health_chatbot_model.pkl"
with model_path.open("rb") as f:
    model, vectorizer = pickle.load(f)

@app.route("/predict", methods=["POST"])
def chat():
    body = request.get_json(silent=True)
    user_input = body.get("message") if isinstance(body, dict) else None
    if not isinstance(user_input, str) or not user_input.strip():
        return jsonify({"error": "A non-empty message is required"}), 400

    cleaned_input = clean_text(user_input)
    if not cleaned_input:
        return jsonify({"error": "Message must contain searchable text"}), 400
    vectorized_input = vectorizer.transform([cleaned_input])
    prediction = model.predict(vectorized_input)[0]
    return jsonify({"response": prediction})

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Health Chatbot API is running 🚀"})

if __name__ == "__main__":
    app.run(debug=False)
