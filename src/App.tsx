import {useState} from "react";

export default function App() {
    const [count, setCount] = useState(1)
    return <div onClick={() => setCount(count + 1)}>
        <h1>Hello from React! {count}</h1>
    </div>;
}