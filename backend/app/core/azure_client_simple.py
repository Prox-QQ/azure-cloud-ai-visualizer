"""Simplified Azure client manager using OpenAI only."""

import logging
from typing import Optional

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class AzureClientManager:
    """Simplified client manager for OpenAI-only operation."""
    
    def __init__(self) -> None:
        self.openai_client: Optional[AsyncOpenAI] = None
        
    async def initialize(self) -> None:
        """Initialize OpenAI client."""
        logger.info("Initializing OpenAI client...")
        
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required")
            
        self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        logger.info("OpenAI client initialized successfully")
        
    async def cleanup(self) -> None:
        """Clean up OpenAI client."""
        logger.info("Cleaning up clients...")
        
        if self.openai_client:
            await self.openai_client.close()
            
        logger.info("Clients cleaned up")
    
    def get_openai_client(self) -> Optional[AsyncOpenAI]:
        """Get the OpenAI client."""
        if not self.openai_client:
            raise RuntimeError("OpenAI client not initialized")
        return self.openai_client
    
    async def chat_completion(self, messages: list, model: str = None) -> dict:
        """Simple chat completion using OpenAI."""
        if not self.openai_client:
            raise RuntimeError("OpenAI client not initialized")
            
        response = await self.openai_client.chat.completions.create(
            model=model or settings.OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )
        
        return {
            "content": response.choices[0].message.content,
            "model": response.model,
            "usage": response.usage.dict() if response.usage else None
        }