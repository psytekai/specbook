c# React Hooks Reference Guide

## Overview

React Hooks are functions that allow you to use React features in functional components. They provide "escape hatches" from React's purely functional paradigm and enable component state management, side effects, and access to React features without class components.

## Core Principles

- **Top-level only**: Call Hooks at the top level of your React function components
- **No conditions**: Don't call Hooks inside loops, conditions, or nested functions
- **Reusable logic**: Create custom Hooks to share stateful logic between components

## Built-in React Hooks

### State Hooks

#### `useState`
Declares a state variable that you can update directly.

```javascript
const [state, setState] = useState(initialState);

// Example
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

#### `useReducer`
Declares a state variable with update logic inside a reducer function. Ideal for complex state logic.

```javascript
const [state, dispatch] = useReducer(reducer, initialState);

// Example
function todoReducer(state, action) {
  switch (action.type) {
    case 'add':
      return [...state, { id: Date.now(), text: action.text }];
    default:
      return state;
  }
}
```

### Context Hooks

#### `useContext`
Reads and subscribes to a context, allowing components to receive information from distant parents without prop drilling.

```javascript
const value = useContext(MyContext);

// Example
const ThemeContext = createContext('light');

function Button() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Click me</button>;
}
```

### Ref Hooks

#### `useRef`
Declares a ref to hold values that don't trigger re-renders when changed, commonly used for DOM access.

```javascript
const ref = useRef(initialValue);

// Example
function TextInput() {
  const inputRef = useRef(null);
  
  const focusInput = () => {
    inputRef.current.focus();
  };
  
  return <input ref={inputRef} />;
}
```

#### `useImperativeHandle`
Customizes the ref value exposed by a component when using `forwardRef`.

```javascript
useImperativeHandle(ref, createHandle, [deps]);
```

### Effect Hooks

#### `useEffect`
Connects a component to external systems. Runs after render and can clean up resources.

```javascript
useEffect(() => {
  // Effect logic
  return () => {
    // Cleanup logic
  };
}, [dependencies]);

// Example
function DataFetcher({ userId }) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const controller = new AbortController();
    
    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then(response => response.json())
      .then(setData);
    
    return () => controller.abort();
  }, [userId]);
  
  return <div>{data ? data.name : 'Loading...'}</div>;
}
```

#### `useLayoutEffect`
Fires synchronously before the browser repaints. Use for DOM measurements.

```javascript
useLayoutEffect(() => {
  // Runs before browser repaint
}, [dependencies]);
```

#### `useInsertionEffect`
Fires before React makes changes to the DOM. Primarily for CSS-in-JS libraries.

```javascript
useInsertionEffect(() => {
  // Insert styles before DOM changes
}, [dependencies]);
```

### Performance Hooks

#### `useMemo`
Caches the result of expensive calculations between re-renders.

```javascript
const memoizedValue = useMemo(() => {
  return expensiveCalculation(a, b);
}, [a, b]);

// Example
function ExpensiveComponent({ items }) {
  const expensiveValue = useMemo(() => {
    return items.reduce((sum, item) => sum + item.value, 0);
  }, [items]);
  
  return <div>Total: {expensiveValue}</div>;
}
```

#### `useCallback`
Caches a function definition between re-renders.

```javascript
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);

// Example
function Parent({ items }) {
  const handleClick = useCallback((id) => {
    // Handle click logic
  }, []);
  
  return items.map(item => 
    <Child key={item.id} onClick={handleClick} />
  );
}
```

#### `useTransition`
Marks state updates as non-urgent transitions to keep the UI responsive.

```javascript
const [isPending, startTransition] = useTransition();

// Example
function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();
  
  const handleSearch = (newQuery) => {
    setQuery(newQuery);
    startTransition(() => {
      setResults(performExpensiveSearch(newQuery));
    });
  };
  
  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <div>Searching...</div>}
      <ResultsList results={results} />
    </div>
  );
}
```

#### `useDeferredValue`
Defers updating non-critical parts of the UI.

```javascript
const deferredValue = useDeferredValue(value);
```

### Utility Hooks

#### `useId`
Generates unique IDs for accessibility attributes.

```javascript
const id = useId();

// Example
function Form() {
  const nameId = useId();
  return (
    <div>
      <label htmlFor={nameId}>Name:</label>
      <input id={nameId} type="text" />
    </div>
  );
}
```

#### `useDebugValue`
Displays a label for custom Hooks in React DevTools.

```javascript
useDebugValue(value, format?);

// Example
function useCustomHook() {
  const [state, setState] = useState('');
  useDebugValue(state ? 'Active' : 'Inactive');
  return [state, setState];
}
```

#### `useSyncExternalStore`
Subscribes to external data sources.

```javascript
const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?);
```

#### `useActionState`
Manages state for form actions and async operations.

```javascript
const [state, formAction] = useActionState(action, initialState);
```

## Best Practices

### 1. Dependencies Management
- Always include all values from component scope used inside the effect in the dependencies array
- Use the ESLint plugin `eslint-plugin-react-hooks` for dependency validation

### 2. Performance Optimization
- Use `useMemo` for expensive computations, not for every value
- Use `useCallback` when passing callbacks to optimized child components
- Consider `useTransition` for non-urgent state updates

### 3. Custom Hooks
- Extract reusable stateful logic into custom Hooks
- Start custom Hook names with "use"
- Return consistent data structures

```javascript
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  
  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  const reset = useCallback(() => setCount(initialValue), [initialValue]);
  
  return { count, increment, decrement, reset };
}
```

### 4. Effect Cleanup
- Always clean up subscriptions, timers, and other resources
- Use AbortController for fetch requests
- Remove event listeners in cleanup functions

### 5. State Updates
- Use functional updates for state that depends on previous state
- Prefer `useReducer` for complex state logic with multiple sub-values

## Migration from Class Components

| Class Component Feature | Hook Equivalent |
|------------------------|-----------------|
| `this.state` | `useState` |
| `this.setState` | `useState` setter |
| `componentDidMount` | `useEffect(() => {}, [])` |
| `componentDidUpdate` | `useEffect(() => {})` |
| `componentWillUnmount` | `useEffect` cleanup function |
| `shouldComponentUpdate` | `React.memo` or `useMemo` |
| Instance variables | `useRef` |
| Context consumption | `useContext` |

## Common Patterns

### Conditional Effects
```javascript
useEffect(() => {
  if (shouldRunEffect) {
    // Effect logic
  }
}, [shouldRunEffect, otherDeps]);
```

### Previous Value Tracking
```javascript
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
```

### Local Storage Sync
```javascript
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });
  
  const setValue = useCallback((value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  }, [key]);
  
  return [storedValue, setValue];
}
```

## Resources

- **Official Documentation**: [react.dev/reference/react/hooks](https://react.dev/reference/react/hooks)
- **Hook Library**: [usehooks.com](https://usehooks.com/)
- **ESLint Plugin**: `eslint-plugin-react-hooks`

---

*This guide covers React Hooks as of 2024-2025. The React team continues to evolve the Hooks API, so always refer to the official documentation for the latest updates.*