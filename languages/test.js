// #cure-自定义书签
// #cure-todo-this is a test

// #region 测试结果

// ===== 1. 变量声明 =====
// 使用不同的变量声明方式
var globalVar = "我是全局变量"; // 函数作用域
let blockScopedVar = "我是块级作用域变量"; // 块级作用域
const CONSTANT_VALUE = "我是常量"; // 常量，不可重新赋值

// #endregion

// #cure-warn this is a test

// ===== 2. 基本数据类型 =====
// 原始数据类型
const primitiveTypes = {
    string: "Hello, World!",
    number: 42,
    bigint: 9007199254740991n,
    boolean: true,
    undefined: undefined,
    null: null,
    symbol: Symbol("unique"),
};

// ===== 3. 引用数据类型 =====
// 对象
const person = {
    name: "张三",
    age: 25,
    hobbies: ["阅读", "编程", "旅行"],
    address: {
        city: "北京",
        street: "长安街",
        test1: {
            test2: "value",
        },
    },
    // 方法
    introduce() {
        return `我叫${this.name}，今年${this.age}岁`;
    },
};

// 数组
const numbers = [1, 2, 3, 4, 5];
const mixedArray = [1, "hello", true, { key: "value" }];

// Map
const myMap = new Map();
myMap.set("name", "李四");
myMap.set("age", 30);

// Set
const mySet = new Set([1, 2, 3, 4, 4, 5]); // 自动去重

// ===== 4. 函数 =====
// 函数声明
function add(a, b) {
    return a + b;
}

// 函数表达式
const multiply = function (a, b) {
    return a * b;
};

// 箭头函数
const divide = (a, b) => a / b;

// 高阶函数
function operate(a, b, operation) {
    return operation(a, b);
}

// 闭包示例
function createCounter() {
    let count = 0;
    return {
        increment() {
            count++;
            return count;
        },
        decrement() {
            count--;
            return count;
        },
        getCount() {
            return count;
        },
    };
}

// fnMap(bad idea) 测试
// fnMap(test) 后续需要
// ===== 5. 类与面向对象编程 =====
// 基类
class Animal {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }

    // 实例方法
    speak() {
        return `${this.name} makes a sound`;
    }

    // 静态方法
    static isAnimal(obj) {
        return obj instanceof Animal;
    }

    // Getter
    get info() {
        return `Name: ${this.name}, Age: ${this.age}`;
    }

    // Setter
    set newName(name) {
        if (name.length > 0) {
            this.name = name;
        }
    }
}

// 继承
class Dog extends Animal {
    constructor(name, age, breed) {
        super(name, age);
        this.breed = breed;
    }

    // 方法重写
    speak() {
        return `${this.name} barks!`;
    }

    // 新方法
    fetch() {
        return `${this.name} is fetching the ball`;
    }
}

// ===== 6. 异步编程 =====
// Promise
const fetchData = () => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            Math.random() > 0.5 ? resolve("数据获取成功!") : reject("数据获取失败!");
        }, 1000);
    });
};

// Async/Await
async function processData() {
    try {
        const data = await fetchData();
        console.log("处理数据:", data);
        return data;
    } catch (error) {
        console.error("错误:", error);
        throw error;
    }
}

// ===== 7. 数组方法 =====
const arrayMethods = {
    // 遍历方法
    forEach: numbers.forEach((num) => console.log(num)),
    map: numbers.map((num) => num * 2),
    filter: numbers.filter((num) => num % 2 === 0),
    reduce: numbers.reduce((sum, num) => sum + num, 0),

    // 查找方法
    find: numbers.find((num) => num > 3),
    some: numbers.some((num) => num > 3),
    every: numbers.every((num) => num > 0),
};

// ===== 8. 解构赋值 =====
// 数组解构
const [first, second, ...rest] = numbers;

// 对象解构
const { name, age, ...otherInfo } = person;

// ===== 9. 模板字符串 =====
const greeting = `
    你好，${person.name}！
    你今年${person.age}岁。
    你的爱好是：${person.hobbies.join(", ")}
`;

// ===== 10. 模块模式 =====
const Calculator = (() => {
    // 私有变量
    let operationCount = 0;

    // 私有方法
    const incrementCount = () => operationCount++;

    // 公有API
    return {
        add: (a, b) => {
            incrementCount();
            return a + b;
        },
        subtract: (a, b) => {
            incrementCount();
            return a - b;
        },
        getOperationCount: () => operationCount,
    };
})();

// ===== 11. 错误处理 =====
function riskyOperation() {
    try {
        // 可能抛出错误的代码
        if (Math.random() > 0.7) {
            throw new Error("随机错误发生!");
        }
        return "操作成功";
    } catch (error) {
        console.error("捕获到错误:", error.message);
        return "操作失败";
    } finally {
        console.log("这是finally块，总是会执行");
    }
}

// ===== 12. 生成器函数 =====
function* numberGenerator() {
    let num = 1;
    while (true) {
        yield num++;
    }
}

// ===== 13. Proxy 和 Reflect =====
const target = { message: "hello" };
const handler = {
    get: function (obj, prop) {
        if (prop in obj) {
            return obj[prop];
        } else {
            return `属性 ${prop} 不存在`;
        }
    },
    set: function (obj, prop, value) {
        if (prop === "age" && typeof value !== "number") {
            throw new Error("年龄必须是数字");
        }
        obj[prop] = value;
        return true;
    },
};

const proxy = new Proxy(target, handler);

// ===== 14. 使用示例 =====
async function demonstrateJavaScriptFeatures() {
    console.log("=== JavaScript 完整特性演示 ===");

    // 变量和数据类型
    console.log("1. 变量和数据类型:", primitiveTypes);

    // 对象和数组
    console.log("2. 对象方法:", person.introduce());
    console.log(
        "3. 数组操作:",
        numbers.map((n) => n * 2)
    );

    // 函数使用
    console.log("4. 函数调用:", operate(10, 5, add));
    console.log("5. 箭头函数:", operate(10, 2, divide));

    // 闭包
    const counter = createCounter();
    console.log("6. 闭包计数器:");
    console.log("初始值:", counter.getCount());
    console.log("增加后:", counter.increment());
    console.log("再次增加:", counter.increment());

    // 类使用
    const dog = new Dog("Buddy", 3, "金毛");
    console.log("7. 类继承:");
    console.log(dog.speak());
    console.log(dog.fetch());
    console.log("是否是动物:", Animal.isAnimal(dog));

    // 异步操作
    console.log("8. 异步操作:");
    try {
        const result = await processData();
        console.log("异步结果:", result);
    } catch (error) {
        console.log("异步错误:", error);
    }

    // 解构赋值
    console.log("9. 解构赋值:");
    console.log("第一个数字:", first);
    console.log("姓名:", name);

    // 错误处理
    console.log("10. 错误处理:", riskyOperation());

    // 生成器
    const gen = numberGenerator();
    console.log("11. 生成器:");
    console.log("第一个值:", gen.next().value);
    console.log("第二个值:", gen.next().value);

    // Proxy
    console.log("12. Proxy:");
    console.log("消息:", proxy.message);
    console.log("不存在的属性:", proxy.nonExistent);

    // 模块模式
    console.log("13. 模块模式:");
    console.log("加法:", Calculator.add(5, 3));
    console.log("操作次数:", Calculator.getOperationCount());

    console.log("=== 演示结束 ===");
}

// 执行演示
demonstrateJavaScriptFeatures().catch(console.error);

// ===== 15. 现代 JavaScript 特性 =====
// 可选链操作符
const optionalChaining = person?.address?.city ?? "未知城市";

// 空值合并运算符
const nullishCoalescing = person.nickname ?? "默认昵称";

// 动态导入
async function loadModule() {
    try {
        const module = await import("./some-module.js");
        return module;
    } catch (error) {
        console.log("模块加载失败");
    }
}

// ===== 16. 迭代器和可迭代对象 =====
const iterableObject = {
    values: [10, 20, 30],
    [Symbol.iterator]() {
        let index = 0;
        return {
            next: () => {
                if (index < this.values.length) {
                    return { value: this.values[index++], done: false };
                } else {
                    return { done: true };
                }
            },
        };
    },
};

// 导出（如果作为模块使用）
// export { person, Animal, Calculator, demonstrateJavaScriptFeatures };
