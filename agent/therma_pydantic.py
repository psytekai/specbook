import json
import re
from typing import Dict, List, Any, Callable, Optional, Union
from pydantic import BaseModel, Field, validator
from enum import Enum


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(BaseModel):
    role: MessageRole
    content: str = Field(..., min_length=1, description="Message content")
    
    class Config:
        use_enum_values = True


class ToolParameter(BaseModel):
    name: str
    type: str = Field(..., description="Parameter type (str, int, float, bool)")
    description: str = Field("", description="Parameter description")
    required: bool = True
    default: Any = None


class Tool(BaseModel):
    name: str = Field(..., min_length=1, description="Tool name")
    description: str = Field(..., min_length=1, description="Tool description")
    parameters: List[ToolParameter] = Field(default_factory=list)
    function: Callable = Field(..., description="The actual function to call")
    
    class Config:
        arbitrary_types_allowed = True  # Allow Callable type
        
    @validator('name')
    def validate_name(cls, v):
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', v):
            raise ValueError('Tool name must be a valid identifier')
        return v
    
    def call(self, **kwargs) -> Any:
        """Execute the tool with given parameters"""
        return self.function(**kwargs)
    
    def get_parameter_schema(self) -> Dict[str, Any]:
        """Get JSON schema for parameters"""
        schema = {"type": "object", "properties": {}, "required": []}
        
        for param in self.parameters:
            schema["properties"][param.name] = {
                "type": param.type,
                "description": param.description
            }
            if param.required:
                schema["required"].append(param.name)
                
        return schema


class ToolCall(BaseModel):
    tool_name: str
    parameters: Dict[str, Any]
    
    @validator('tool_name')
    def validate_tool_name(cls, v):
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', v):
            raise ValueError('Tool name must be a valid identifier')
        return v


class ToolResult(BaseModel):
    tool_name: str
    success: bool
    result: Any = None
    error: Optional[str] = None
    
    def __str__(self) -> str:
        if self.success:
            return f"Tool '{self.tool_name}' result: {self.result}"
        else:
            return f"Error in tool '{self.tool_name}': {self.error}"


class AgentConfig(BaseModel):
    system_prompt: str = "You are a helpful assistant."
    max_iterations: int = Field(default=10, ge=1, le=100)
    enable_tool_calls: bool = True
    
    @validator('system_prompt')
    def validate_system_prompt(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('System prompt cannot be empty')
        return v


class ConversationHistory(BaseModel):
    messages: List[Message] = Field(default_factory=list)
    
    def add_message(self, role: MessageRole, content: str) -> None:
        message = Message(role=role, content=content)
        self.messages.append(message)
    
    def get_recent_messages(self, count: int = 10) -> List[Message]:
        return self.messages[-count:] if count > 0 else self.messages
    
    def clear(self) -> None:
        self.messages.clear()


class Agent(BaseModel):
    config: AgentConfig = Field(default_factory=AgentConfig)
    conversation: ConversationHistory = Field(default_factory=ConversationHistory)
    tools: Dict[str, Tool] = Field(default_factory=dict)
    
    class Config:
        arbitrary_types_allowed = True
    
    def add_tool(self, tool: Tool) -> None:
        """Register a tool that the agent can use"""
        self.tools[tool.name] = tool
        
    def remove_tool(self, tool_name: str) -> bool:
        """Remove a tool by name"""
        if tool_name in self.tools:
            del self.tools[tool_name]
            return True
        return False
    
    def get_tool_descriptions(self) -> str:
        """Format available tools for the LLM prompt"""
        if not self.tools:
            return ""
            
        tools_desc = "\n\nAvailable tools:\n"
        for name, tool in self.tools.items():
            tools_desc += f"- {name}: {tool.description}\n"
            if tool.parameters:
                tools_desc += f"  Parameters: {json.dumps(tool.get_parameter_schema(), indent=2)}\n"
            
        tools_desc += "\nTo use a tool, respond with: TOOL_CALL: {tool_name} {json_parameters}"
        return tools_desc
    
    def _extract_tool_calls(self, response: str) -> List[ToolCall]:
        """Extract and validate tool calls from LLM response"""
        tool_calls = []
        pattern = r'TOOL_CALL:\s*(\w+)\s*({.*?})'
        matches = re.findall(pattern, response, re.DOTALL)
        
        for tool_name, params_str in matches:
            try:
                params = json.loads(params_str)
                tool_call = ToolCall(tool_name=tool_name, parameters=params)
                tool_calls.append(tool_call)
            except (json.JSONDecodeError, ValueError) as e:
                # Skip invalid tool calls
                continue
                
        return tool_calls
    
    def _execute_tool(self, tool_call: ToolCall) -> ToolResult:
        """Execute a tool call and return structured result"""
        if tool_call.tool_name not in self.tools:
            return ToolResult(
                tool_name=tool_call.tool_name,
                success=False,
                error=f"Tool '{tool_call.tool_name}' not found"
            )
            
        try:
            tool = self.tools[tool_call.tool_name]
            result = tool.call(**tool_call.parameters)
            return ToolResult(
                tool_name=tool_call.tool_name,
                success=True,
                result=result
            )
        except Exception as e:
            return ToolResult(
                tool_name=tool_call.tool_name,
                success=False,
                error=str(e)
            )
    
    def _call_llm(self, messages: List[Message]) -> str:
        """
        Mock LLM call - replace this with actual LLM API call
        This is where you'd integrate with OpenAI, Anthropic, etc.
        """
        # For demo purposes, we'll simulate responses
        user_msg = messages[-1].content.lower()
        
        # Simple pattern matching for demo
        if "calculator" in user_msg or "calculate" in user_msg:
            if "2 + 2" in user_msg:
                return "TOOL_CALL: calculator {\"operation\": \"add\", \"a\": 2, \"b\": 2}"
            elif "10 * 5" in user_msg:
                return "TOOL_CALL: calculator {\"operation\": \"multiply\", \"a\": 10, \"b\": 5}"
        
        if "weather" in user_msg:
            return "TOOL_CALL: get_weather {\"location\": \"New York\"}"
            
        # Default response
        return "I'm a mock LLM. To see tool usage, try asking me to calculate 2 + 2 or get the weather."
    
    def chat(self, user_input: str) -> str:
        """Main chat interface with full type safety"""
        # Validate and add user message
        self.conversation.add_message(MessageRole.USER, user_input)
        
        # Prepare messages for LLM
        system_message = Message(
            role=MessageRole.SYSTEM, 
            content=self.config.system_prompt + self.get_tool_descriptions()
        )
        messages = [system_message] + self.conversation.get_recent_messages()
        
        # Agent loop with tool calling
        for iteration in range(self.config.max_iterations):
            # Get LLM response
            response = self._call_llm(messages)
            
            # Check for tool calls if enabled
            if not self.config.enable_tool_calls:
                self.conversation.add_message(MessageRole.ASSISTANT, response)
                return response
            
            tool_calls = self._extract_tool_calls(response)
            
            if not tool_calls:
                # No tool calls, return the response
                self.conversation.add_message(MessageRole.ASSISTANT, response)
                return response
            
            # Execute tool calls
            tool_results = []
            for call in tool_calls:
                result = self._execute_tool(call)
                tool_results.append(result)
            
            # Add tool results to conversation
            tool_response = "\n".join(str(result) for result in tool_results)
            messages.append(Message(role=MessageRole.ASSISTANT, content=response))
            messages.append(Message(role=MessageRole.USER, content=f"Tool results: {tool_response}"))
            
            # Continue the loop to get final response
            
        return "Max iterations reached"
    
    def get_conversation_dict(self) -> List[Dict[str, str]]:
        """Get conversation history as dictionary"""
        return [msg.dict() for msg in self.conversation.messages]
    
    def reset_conversation(self) -> None:
        """Clear conversation history"""
        self.conversation.clear()


# Example tool functions with type hints
def calculator(operation: str, a: float, b: float) -> Union[float, str]:
    """Simple calculator tool with proper type hints"""
    ops = {
        'add': lambda x, y: x + y,
        'subtract': lambda x, y: x - y,
        'multiply': lambda x, y: x * y,
        'divide': lambda x, y: x / y if y != 0 else "Error: Division by zero"
    }
    return ops.get(operation, lambda x, y: "Unknown operation")(a, b)


def get_weather(location: str) -> str:
    """Mock weather tool with validation"""
    if not location.strip():
        raise ValueError("Location cannot be empty")
    return f"The weather in {location} is sunny, 72°F"


def web_search(query: str, max_results: int = 5) -> str:
    """Mock web search tool with optional parameters"""
    if not query.strip():
        raise ValueError("Query cannot be empty")
    return f"Search results for '{query}': [Mock search results] (max: {max_results})"


# Example usage
if __name__ == "__main__":
    # Create agent with custom config
    config = AgentConfig(
        system_prompt="You are a helpful assistant with access to tools.",
        max_iterations=5,
        enable_tool_calls=True
    )
    
    agent = Agent(config=config)
    
    # Add tools with proper parameter definitions
    calculator_tool = Tool(
        name="calculator",
        description="Perform basic math operations",
        function=calculator,
        parameters=[
            ToolParameter(name="operation", type="string", description="Operation: add, subtract, multiply, divide", required=True),
            ToolParameter(name="a", type="number", description="First number", required=True),
            ToolParameter(name="b", type="number", description="Second number", required=True)
        ]
    )
    
    weather_tool = Tool(
        name="get_weather",
        description="Get weather information for a location",
        function=get_weather,
        parameters=[
            ToolParameter(name="location", type="string", description="Location name", required=True)
        ]
    )
    
    search_tool = Tool(
        name="web_search",
        description="Search the web for information",
        function=web_search,
        parameters=[
            ToolParameter(name="query", type="string", description="Search query", required=True),
            ToolParameter(name="max_results", type="integer", description="Maximum results", required=False, default=5)
        ]
    )
    
    # Register tools
    agent.add_tool(calculator_tool)
    agent.add_tool(weather_tool)
    agent.add_tool(search_tool)
    
    # Interactive chat
    print("Agent initialized. Type 'quit' to exit.")
    print("Try: 'Calculate 2 + 2' or 'What's the weather in New York?'")
    
    while True:
        user_input = input("\nYou: ")
        if user_input.lower() == 'quit':
            break
            
        try:
            response = agent.chat(user_input)
            print(f"Agent: {response}")
        except Exception as e:
            print(f"Error: {e}")