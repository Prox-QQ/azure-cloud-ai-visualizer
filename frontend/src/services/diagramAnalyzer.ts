/**
 * Service to analyze uploaded architecture diagrams using AI vision
 */

export interface DiagramAnalysisResult {
  services: string[];
  connections: { from_service: string; to_service: string; label?: string }[];
  description: string;
  suggested_services: string[];
  groups?: DiagramAnalysisGroup[];
}

export interface DiagramAnalysisGroup {
  id: string;
  label: string;
  group_type?: string;
  members?: string[];
  parent_id?: string | null;
  metadata?: Record<string, unknown>;
}

export class DiagramAnalyzer {
  /**
   * Analyze an uploaded image and extract architecture information
   */
  static async analyzeImage(imageFile: File): Promise<DiagramAnalysisResult> {
    try {
      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      
      // Send to backend for analysis
      const API_BASE_URL = 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/analyze-diagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          format: imageFile.type
        })
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.analysis;
    } catch (error) {
      console.error('Diagram analysis failed:', error);
      throw error;
    }
  }
  
  /**
   * Convert file to base64 
   */
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (data:image/jpeg;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Validate image file type and size
   */
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)'
      };
    }
    
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'Image file is too large. Please upload an image smaller than 10MB'
      };
    }
    
    return { valid: true };
  }
}
