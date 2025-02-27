import os
import subprocess
import tempfile
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import sys

# Set up Gemini API key
GEMINI_API_KEY = "AIzaSyDetzfkniI_VB2_jNtYjCXXOolhquNGAmw"  # Your provided API key
os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY  # Set the environment variable

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# Route to debug code and generate questions
@app.route('/debug', methods=['POST'])
def debug_code():
    data = request.get_json()
    code = data.get('code')
    language = data.get('language')
    user_input = data.get('user_input', "")

    if not code or not language:
        return jsonify({"error": "Code or language missing"}), 400

    # Execute the code
    output_response = execute_code(code, language, user_input)

    # Generate questions using the Gemini API
    questions = generate_questions(code)

    return jsonify({
        "output": output_response.get("output", ""),
        "error": output_response.get("error", ""),
        "questions": questions
    })

# Route to auto-correct code
@app.route('/autocorrect', methods=['POST'])
def auto_correct_code():
    data = request.get_json()
    code = data.get('code')

    if not code:
        return jsonify({"error": "Code missing"}), 400

    # Auto-correct the code using Gemini API
    corrected_code = correct_code_using_gemini(code)

    return jsonify({
        "corrected_code": corrected_code
    })

# Function to execute code based on language
def execute_code(code, language, user_input=""):
    try:
        with tempfile.NamedTemporaryFile(suffix=f'.{language}', delete=False) as temp_file:
            temp_file.write(code.encode())
            temp_file.close()

            if language == "python":
                python_executable = sys.executable  # Correct Python version
                result = subprocess.run([python_executable, temp_file.name], input=user_input.encode(), capture_output=True, text=True)
            elif language == "cpp":
                exe_file = temp_file.name.replace('.cpp', '.exe')
                compile_result = subprocess.run(['g++', temp_file.name, '-o', exe_file], capture_output=True, text=True)
                if compile_result.returncode != 0:
                    return {"error": compile_result.stderr}
                result = subprocess.run([exe_file], input=user_input.encode(), capture_output=True, text=True)
            elif language == "java":
                class_name = extract_java_class_name(code)
                if not class_name:
                    return {"error": "No public class found in Java code."}
                
                temp_dir = os.path.dirname(temp_file.name)
                java_file_name = f"{temp_dir}/{class_name}.java"
                
                if os.path.exists(java_file_name):
                    os.remove(java_file_name)
                
                os.rename(temp_file.name, java_file_name)

                if not os.path.exists(java_file_name):
                    return {"error": "Renaming failed"}

                compile_result = subprocess.run(['javac', java_file_name], capture_output=True, text=True)
                if compile_result.returncode != 0:
                    return {"error": compile_result.stderr}

                result = subprocess.run(['java', '-cp', temp_dir, class_name], input=user_input.encode(), capture_output=True, text=True)

                if os.path.exists(java_file_name):
                    os.remove(java_file_name)
            elif language == "c":
                exe_file = temp_file.name.replace('.c', '.exe')
                compile_result = subprocess.run(['gcc', temp_file.name, '-o', exe_file], capture_output=True, text=True)
                if compile_result.returncode != 0:
                    return {"error": compile_result.stderr}
                result = subprocess.run([exe_file], input=user_input.encode(), capture_output=True, text=True)
            else:
                return {"error": "Unsupported language"}

            os.remove(temp_file.name)
            return {"output": result.stdout if result.returncode == 0 else "", "error": result.stderr if result.returncode != 0 else ""}
    except Exception as e:
        return {"error": str(e)}


# Function to generate 5 questions using Gemini API
def generate_questions(code):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        headers = {'Content-Type': 'application/json'}
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"Analyze the following code and generate 5 conceptual or practical questions:\n\n{code}"
                        }
                    ]
                }
            ]
        }

        response = requests.post(url, headers=headers, json=payload)

        if response.status_code == 200:
            result = response.json()
            questions = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
            return questions.split("\n")
        else:
            return [f"Error: {response.status_code} - {response.text}"]
    except Exception as e:
        return [f"Error generating questions: {str(e)}"]

# Function to extract Java class name
def extract_java_class_name(code):
    import re
    match = re.search(r'public\s+class\s+(\w+)', code)
    return match.group(1) if match else None

def correct_code_using_gemini(code):
    try:
        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
        if not GEMINI_API_KEY:
            return "Error: Gemini API key not set"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"Correct the following code and improve it:\n\n{code}"
                        }
                    ]
                }
            ]
        }

        response = requests.post(url, headers=headers, json=payload)

        if response.status_code == 200:
            response_data = response.json()
            corrected_code = response_data["candidates"][0]["content"]["parts"][0]["text"]
            return corrected_code.strip()
        else:
            return f"Error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Error: {str(e)}"
# Run Flask app
if __name__ == '__main__':
    app.run(debug=True)
