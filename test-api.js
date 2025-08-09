// Simple test script to verify Gemini API connectivity
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

async function testGeminiAPI(apiKey) {
  try {
    console.log('Testing Gemini API with key:', apiKey.substring(0, 10) + '...');
    
    const response = await fetch(`${API_BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Say "Hello" to test the connection.'
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100
        }
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return false;
    }

    const data = await response.json();
    console.log('Success response:', data);
    return true;

  } catch (error) {
    console.error('Network error:', error);
    return false;
  }
}

// Test with a dummy key format to see error response
testGeminiAPI('AIza1234567890123456789012345678901234567');
