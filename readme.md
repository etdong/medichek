## medichek (client package)

This folder holds the client-side web interface for the patient-side application.

## Client Setup

The client is a simple HTML webpage that connects to the Django server running on port 8000.

### Prerequisites

Make sure the Django server is running:
- The server should be running at `http://127.0.0.1:8000`
- The server must have the `/api/` endpoint available
- CORS should be enabled on the server to accept requests from the client

### Running the Client

#### Development Mode (Recommended)

Use the development server with **live reload** for automatic refresh on file changes:

```powershell
# Quick start - double click the batch file:
run_dev_server.bat

# Or run manually:
python dev_server.py
```

The dev server will:
- Serve the client at `http://127.0.0.1:8080`
- Watch for changes in HTML, CSS, and JS files
- Automatically reload the browser when files change
- Open the browser automatically

#### Production/Simple Mode

Simply open the HTML file in a web browser:

```powershell
# Option 1: Open directly in browser (no live reload)
start templates\index.html

# Option 2: Use run_client.bat
run_client.bat
```

### Client Features

The client webpage includes:
- A button to send dummy patient medication data to the server
- Real-time display of server responses
- Error handling and user feedback
- Sample JSON data (patient_id, medication, dosage, frequency, etc.)

### JSON Data Format

The client sends POST requests to `http://127.0.0.1:8000/api/receive-json/` with this format:

```json
{
  "patient_id": "12345",
  "medication": "Aspirin",
  "dosage": "100mg",
  "frequency": "Once daily",
  "last_taken": "2025-11-04T10:30:00",
  "notes": "Patient reported no side effects"
}
```

## Notes
- The server is located in a separate directory (not in this folder)
- This folder contains only the client-side webpage
- Make sure the server is running on port 8000 before using the client
