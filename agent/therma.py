import json
import re
from typing import Dict, List, Any, Callable, Optional
from dataclasses import dataclass, asdict


@dataclass
class Message:
    role: str  # 'user', 'assistant', 'system'
    content: str
    
    def to_dict(self) -> Dict[str, str]:
        return asdict(self)


@dataclass
class Tool:
    name: str
    description: str
    function: Callable
    parameters: Dict[str, Any]
    
    def call(self, **kwargs) -> Any:
        return self.function(**kwargs)


class Agent:
    def __init__(self, system_prompt: str = "You are a helpful assistant."):
        self.system_prompt = system_prompt
        self.conversation_history: List[Message] = []
        self.tools: Dict[str, Tool] = {}
        self.max_iterations = 10
        
    def add_tool(self, tool: Tool):
        """Register a tool that the agent can use"""
        self.tools[tool.name] = tool
        
    def _format_tools_for_prompt(self) -> str:
        """Format available tools for the LLM prompt"""
        if not self.tools:
            return ""
            
        tools_desc = "\n\nAvailable tools:\n"
        for name, tool in self.tools.items():
            tools_desc += f"- {name}: {tool.description}\n"
            tools_desc += f"  Parameters: {tool.parameters}\n"
            
        tools_desc += "\nTo use a tool, respond with: TOOL_CALL: {tool_name} {json_parameters}"
        return tools_desc
    
    def _extract_tool_calls(self, response: str) -> List[Dict[str, Any]]:
        """Extract tool calls from LLM response"""
        tool_calls = []
        pattern = r'TOOL_CALL:\s*(\w+)\s*({.*?})'
        matches = re.findall(pattern, response, re.DOTALL)
        
        for tool_name, params_str in matches:
            try:
                params = json.loads(params_str)
                tool_calls.append({
                    'tool_name': tool_name,
                    'parameters': params
                })
            except json.JSONDecodeError:
                continue
                
        return tool_calls
    
    def _execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> str:
        """Execute a tool and return the result"""
        if tool_name not in self.tools:
            return f"Error: Tool '{tool_name}' not found"
            
        try:
            result = self.tools[tool_name].call(**parameters)
            return f"Tool '{tool_name}' result: {result}"
        except Exception as e:
            return f"Error executing tool '{tool_name}': {str(e)}"
    
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
        """Main chat interface"""
        # Add user message
        user_msg = Message(role="user", content=user_input)
        self.conversation_history.append(user_msg)
        
        # Prepare messages for LLM
        messages = [Message(role="system", content=self.system_prompt + self._format_tools_for_prompt())]
        messages.extend(self.conversation_history)
        
        # Agent loop with tool calling
        for iteration in range(self.max_iterations):
            # Get LLM response
            response = self._call_llm(messages)
            
            # Check for tool calls
            tool_calls = self._extract_tool_calls(response)
            
            if not tool_calls:
                # No tool calls, return the response
                assistant_msg = Message(role="assistant", content=response)
                self.conversation_history.append(assistant_msg)
                return response
            
            # Execute tool calls
            tool_results = []
            for call in tool_calls:
                result = self._execute_tool(call['tool_name'], call['parameters'])
                tool_results.append(result)
            
            # Add tool results to conversation
            tool_response = "\n".join(tool_results)
            messages.append(Message(role="assistant", content=response))
            messages.append(Message(role="user", content=f"Tool results: {tool_response}"))
            
            # Continue the loop to get final response
            
        return "Max iterations reached"
    
    def get_conversation(self) -> List[Dict[str, str]]:
        """Get conversation history"""
        return [msg.to_dict() for msg in self.conversation_history]


# Example tools
def calculator(operation: str, a: float, b: float) -> float:
    """Simple calculator tool"""
    ops = {
        'add': lambda x, y: x + y,
        'subtract': lambda x, y: x - y,
        'multiply': lambda x, y: x * y,
        'divide': lambda x, y: x / y if y != 0 else "Error: Division by zero"
    }
    return ops.get(operation, lambda x, y: "Unknown operation")(a, b)


def get_weather(location: str) -> str:
    """Mock weather tool"""
    return f"The weather in {location} is sunny, 72°F"


def web_search(query: str) -> str:
    """Mock web search tool"""
    return f"Search results for '{query}': [Mock search results]"


# Example usage
if __name__ == "__main__":
    # Create agent
    agent = Agent("You are a helpful assistant with access to tools.")
    
    # Add tools
    agent.add_tool(Tool(
        name="calculator",
        description="Perform basic math operations",
        function=calculator,
        parameters={"operation": "str", "a": "float", "b": "float"}
    ))
    
    agent.add_tool(Tool(
        name="get_weather",
        description="Get weather information for a location",
        function=get_weather,
        parameters={"location": "str"}
    ))
    
    agent.add_tool(Tool(
        name="web_search",
        description="Search the web for information",
        function=web_search,
        parameters={"query": "str"}
    ))
    
    # Interactive chat
    print("Agent initialized. Type 'quit' to exit.")
    print("Try: 'Calculate 2 + 2' or 'What's the weather in New York?'")
    
    while True:
        user_input = input("\nYou: ")
        if user_input.lower() == 'quit':
            break
            
        response = agent.chat(user_input)
        print(f"Agent: {response}")