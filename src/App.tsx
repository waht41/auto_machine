import {useState} from "react";

export default function App() {
    const [count, setCount] = useState(1)
    const [value, setValue] = useState('')
    return <div onClick={() => setCount(count + 1)}>
        <input value={value} onChange={(e) =>
            setValue(e.target.value)
        }></input>
    </div>;
}