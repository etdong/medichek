"""
Medichek Client Development Server
Serves the client webpage with live reload on file changes
"""
from livereload import Server
import os

def main():
    # Get the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(current_dir, 'templates')
    
    # Create server instance
    server = Server()
    
    # Watch for changes in templates directory
    server.watch(os.path.join(templates_dir, '*.html'))
    server.watch(os.path.join(templates_dir, '*.css'))
    server.watch(os.path.join(templates_dir, '*.js'))
    
    print("=" * 60)
    print("🏥 Medichek Client Development Server")
    print("=" * 60)
    print(f"📁 Serving files from: {templates_dir}")
    print(f"🌐 Server running at: http://127.0.0.1:8080")
    print(f"🔄 Live reload enabled - changes will refresh automatically")
    print(f"⚠️  Make sure the backend server is running at http://127.0.0.1:8000")
    print("=" * 60)
    print("Press Ctrl+C to stop the server")
    print()
    
    # Serve the templates directory on port 8080
    server.serve(
        root=templates_dir,
        port=8080,
        host='127.0.0.1',
        open_url_delay=1  # Open browser after 1 second
    )

if __name__ == '__main__':
    main()
