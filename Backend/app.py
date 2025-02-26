import subprocess
import tempfile
import os
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Set up Gemini API key
GEMINI_API_KEY = "YOUR_API_KEY"  # Replace with your actual API key
genai.configure(api_key=GEMINI_API_KEY)

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

    # Generate questions using Gemini
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

    # Auto-correct the code using Gemini
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

            print(f"Temporary file created: {temp_file.name}")

            if language == "python":
                result = subprocess.run(['python', temp_file.name], input=user_input, capture_output=True, text=True)
            elif language == "cpp":
                exe_file = temp_file.name.replace('.cpp', '.exe')
                compile_result = subprocess.run(['g++', temp_file.name, '-o', exe_file], capture_output=True, text=True)
                if compile_result.returncode != 0:
                    return {"error": compile_result.stderr}
                result = subprocess.run([exe_file], input=user_input, capture_output=True, text=True)
            elif language == "java":
                class_name = extract_java_class_name(code)
                if not class_name:
                    return {"error": "No public class found in Java code."}
                
                temp_dir = os.path.dirname(temp_file.name)
                java_file_name = f"{temp_dir}/{class_name}.java"
                
                print(f"Java file path: {java_file_name}")

                if os.path.exists(java_file_name):
                    os.remove(java_file_name)
                
                os.rename(temp_file.name, java_file_name)

                if not os.path.exists(java_file_name):
                    return {"error": "Renaming failed"}

                compile_result = subprocess.run(['javac', java_file_name], capture_output=True, text=True)
                if compile_result.returncode != 0:
                    return {"error": compile_result.stderr}

                result = subprocess.run(['java', '-cp', temp_dir, class_name], input=user_input, capture_output=True, text=True)

                if os.path.exists(java_file_name):
                    os.remove(java_file_name)
            elif language == "c":
                exe_file = temp_file.name.replace('.c', '.exe')
                compile_result = subprocess.run(['gcc', temp_file.name, '-o', exe_file], capture_output=True, text=True)
                if compile_result.returncode != 0:
                    return {"error": compile_result.stderr}
                result = subprocess.run([exe_file], input=user_input, capture_output=True, text=True)
            else:
                return {"error": "Unsupported language"}

            os.remove(temp_file.name)
            return {"output": result.stdout if result.returncode == 0 else "", "error": result.stderr if result.returncode != 0 else ""}
    except Exception as e:
        return {"error": str(e)}

# Function to auto-correct code using Gemini
def correct_code_using_gemini(code):
    try:
        prompt = f"Correct the following code:\n\n{code}"
        model = genai.GenerativeModel("gemini-pro")
        response = model.generate_content(prompt)
        corrected_code = response.text.strip()
        return corrected_code
    except Exception as e:
        return code  # Return original code if there is an error

# Extract Java class name
def extract_java_class_name(code):
    for line in code.split("\n"):
        if "public class" in line:
            return line.split()[2].strip()
    return None

# Function to generate 5 questions using Gemini API
def generate_questions(code):
    try:
        prompt = f"Analyze the following code and generate 5 conceptual or practical questions:\n\n{code}"
        model = genai.GenerativeModel("gemini-pro")
        response = model.generate_content(prompt)
        return response.text.split("\n")[:5]  # Extract first 5 questions
    except Exception as e:
        return [f"Error generating questions: {str(e)}"]

# Run Flask app
if __name__ == '__main__':
    app.run(debug=True)
