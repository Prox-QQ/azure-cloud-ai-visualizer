# Azure Architect Backend

A Python FastAPI backend for the Azure Architect application, providing REST API endpoints and WebSocket connections for:

- **Project Management**: Save/load ReactFlow diagrams with Azure Blob storage
- **Microsoft Agent Framework Integration**: Chat-driven architecture planning
- **Infrastructure as Code Generation**: Generate Bicep/Terraform from diagrams  
- **Azure Deployment Orchestration**: Deploy resources and monitor progress
- **Real-time Communication**: WebSocket support for chat and deployment updates

## Quick Start

1. **Install dependencies**
   ```bash
   pip install uv
   uv install
   ```

2. **Configure environment**
   ```bash
   cp .env.template .env
   # Edit .env with your Azure settings
   ```

3. **Run the server**
   ```bash
   python main.py
   ```

## API Endpoints

- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `POST /api/iac/generate` - Generate IaC from diagram
- `POST /api/deployment/deploy` - Deploy to Azure
- `POST /api/chat` - Chat with AI architect
- `ws://localhost:8000/ws/chat` - Real-time chat WebSocket

## Features

✅ **Complete Backend Implementation**
- FastAPI application with async support
- Microsoft Agent Framework integration
- Azure Blob Storage for persistence
- WebSocket real-time communication
- Comprehensive API endpoints
- Production-ready architecture

🤖 **AI-Powered Architecture Assistant**
- Chat with Azure expert using MAF
- Analyze ReactFlow diagrams
- Generate Bicep templates
- Provide deployment guidance
- Context-aware responses

🏗️ **Full Project Lifecycle**
- Create/manage projects
- Upload/manage assets
- Generate IaC templates
- Deploy to Azure
- Monitor deployments

## Technology Stack

- **FastAPI** - Modern Python web framework
- **Microsoft Agent Framework** - AI orchestration
- **Azure SDK** - Cloud service integration
- **WebSockets** - Real-time features
- **Pydantic** - Data validation

See full documentation in the complete README above.