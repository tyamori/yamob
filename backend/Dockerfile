# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Install git and build tools needed for dependencies like python-rvo2
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    cmake \
 && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# --no-cache-dir: Don't store the downloaded packages locally within the image
# --upgrade pip: Ensure we have the latest pip
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir Cython && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code into the container at /app
COPY . .

# Make port 5001 available to the world outside this container
# (This is the port Flask/Eventlet seems to be configured to use in app.py)
EXPOSE 5001

# Define environment variables (optional, can be overridden)
# ENV FLASK_APP=app.py # Not strictly needed if using `flask run` or direct execution
# ENV FLASK_RUN_HOST=0.0.0.0 # Make the server accessible externally

# Run app.py when the container launches using eventlet
# Use a list format for CMD to avoid shell processing issues
CMD ["python", "-u", "app.py"]

# Alternative CMD using flask run (might need adjustment for eventlet/socketio):
# CMD ["flask", "run", "--host=0.0.0.0", "--port=5001"] 