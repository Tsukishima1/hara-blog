---
title: 使用 honojs + appWrite 构建后端服务
date: 2024-10-22
description: 代替传统后端技术栈，试试这俩新玩意儿来构建项目的后端，主要使用在 api 和 数据库的部分
tag: hara-projectie, 项目
author: Xayah
---

Honojs 相当于 Express，是一个跨平台、轻量级的高性能 Web 框架
## Next.js 中使用 Hono
官网说明需要在 `app/api/[[...route]]/route.ts` 写如下代码：
```ts
import { Hono } from 'hono'  
import { handle } from 'hono/vercel'  
  
const app = new Hono().basePath('/api')  
  
const routes = app
	.route("/auth", auth) // 配置路由路径
	
// 为app声明各种请求指令
export const GET = handle(app)  
export const POST = handle(app)  
export const PUT = handle(app)  
export const DELETE = handle(app)

export type AppType = typeof routes

// 以上代码一般情况写完就不用动了
```
但把后端代码插进前端代码文件会显得混乱，会导致不必要的热更新，除了声明以外的其他后端业务代码放在根目录下的 `server ` 目录会更好
## 各种请求响应和处理逻辑
一般写在 `server/(类似user)/index.ts` 下，指该模块下的所有 api
```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginSchema, registSchema } from "@/data/schemas";
// ↑ 指的是数据类型们

const app=new Hono()
	.post("/login", zValidator("json",loginSchema),
	                // ↑ 检查数据类型
	    async(c)=>{
	        // ...相关逻辑
	        return c.json({ ... })
	    }
	)
	.post("/regist", zValidator("json",registSchema),
	    async(c)=>{
	        // ...相关逻辑
	        return c.json({ ... })
	    }
	);

export default app;
```
## 设置客户端 api 调用逻辑
一般写在 `app/lib/rpc.ts` 文件中
```ts
import { hc } from "hono/client";
import { AppType } from "@/app/api/[[...route]]/route";

export const client = hc<AppType>(process.env.NEXT_PUBLIC_APP_URL!);
// http://localhost:3000
```
注意这个 `NEXT_PUBLIC_APP_URL` 写于 `.env.local` 中

- **`hc` 从 `"hono/client"` 引入**:
    - `hc` 是 Hono 框架提供的一个用于创建 HTTP 客户端的函数，专门用于和服务端 API 进行通信。它可以帮助你定义和调用远程 API，并自动解析响应。
- **`AppType`**:
    - `AppType` 是从你的应用的 API 路由文件中导入的类型，它定义了 API 路由的接口和返回值结构。通过定义 `AppType`，你能够在调用 API 时==获得 TypeScript 类型提示==，确保请求和响应的数据结构符合预期。
- **`hc<AppType>`**:
    - `hc<AppType>` 表示你正在为这个 HTTP 客户端指定类型 `AppType`，这样你可以在代码中严格控制 API 调用的类型，避免调用错误的 API 路由或传递错误的参数。
## 定义自定义 hook `use-xxx`
例如：`use-login` 处理用户登录操作，使用 `@tanstack/react-query` 库中的 `useMutation` 钩子来管理异步的登录请求
```ts
import { useMutation } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
// 用于推断请求和响应的类型
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.auth.login["$post"]>;
type RequestType = InferRequestType<typeof client.api.auth.login["$post"]>;

export const useLogin = () => {
    const mutation = useMutation<ResponseType,Error,RequestType>({
        mutationFn: async ({ json }) => {
            const response = await client.api.auth.login["$post"]({ json });
            // 即将接收的json作为参数发送POST请求
            return await response.json();
        },
    })
    return mutation;
    // 包含了mutate/isLoading/isError等，可以在组件中使用这些状态和方法来处理操作辣
}
```
## 现在开始在组件中使用它们吧！
例如：在 `app/features/components/sign-in-card.tsx` 使用
```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLogin } from "../api/use-login"
import { loginSchema } from "../schemas"
...

export const SignInCard = () => {
	const { mutate } = useLogin(); // 提出mutate方法
	
	// 和shadcn的form组件配合使用，仍然出现了zod
	const form=useForm<z.infer<typeof loginSchema>>({
	    resolver: zodResolver(loginSchema),
	    defaultValues: {
	        email: "",
	        password: ""
	    }
	})
	
	const onSubmit=(values:z.infer<typeof loginSchema>){
	    mutate({json: values})
	}
	
	return (
	    // ...
	)
}
```
## 获取并处理 appwrite 的错误
完善业务逻辑的时候，发现如果出现参数错误以及 appwrite 发现的类似“账号或密码不正确”的报错，客户端会没有任何反应或者只出现 `Internet Server Error`，查了一圈文档知道了是因为没有处理来自 appwrite 返回的错误信息。
```ts
// 原代码：
.post(
    "/login",
    zValidator("json", loginSchema),
    async (c) => {
        ...
        return c.json({ success: true, message: "Login successful" });
    }
)
```
----
```ts
// 导入
import { AppwriteException } from "node-appwrite"
// 使用try-catch加上错误处理：
.post(
    "/login",
    zValidator("json", loginSchema),
    async (c) => {
        try {
            ...
            return c.json({success: true, message: "Login successful"});
        } catch (error) {
            if (error instanceof AppwriteException) {
                return c.json({success: false, message: error.message}, {status: error.code});
            }
            console.error("Unexpected error:", error);
            return c.json({ success: false, message: "An unexpected error occurred" }, { status: 500 });
        }
    }
)
```
或者另外写一个 `error-handler.ts` 在 `lib` 里，会更简洁：
```ts
import { AppwriteException } from "node-appwrite";
export const ErrorHandler = (error: unknown) => {
    if (error instanceof AppwriteException) {
      return { success: false, message: error.message, statusCode: error.code };
    }
    // 处理其他未知错误
    console.error("Unexpected error:", error);
    return { success: false, message: "An unexpected error occurred", statusCode: 500 };
};
```
导入使用：
![Local Image](../../public/images/Pasted%20image%2020241024004353.png)

使用 `sonner` 通知组件，成功或者失败都会呼出提示信息，这里我选择使用 `useEffect` 来监听 `data.success` 的值（`data` 是在定义 api 时候 ` useMutation ` 钩子赋予的属性 **不确定!! 待考证!!**，指的是响应的 json 内容）
```tsx
// 感觉哪里怪怪的...待优化（
useEffect(()=>{
  if(status==="pending") setIsLoading(true)
  else if(status!== "idle") {
    setIsLoading(false)
    if(!data?.success) {
      toast.error(data?.message)
    }else {
      toast.success(data?.message)
    }
  }
},[status,data])
```
## 为什么不用 nextjs 自带的 api route？
Nextjs 的 API Routes 是基于 nodejs 的，不如 Hono 框架轻量，而且 Hono 支持浏览器运行环境，使得 API 请求可以更接近用户地理位置被处理，从而提升响应速度，比 Nextjs 更适合在服务器上运行。

最重要的一点是，使用 Hono 可以与 TS 结合得更加紧密，使用类型约束来确保前后端的类型安全，保证使用客户端调用 api 时不会传递错误的参数类型，虽然 nextjs 也可以使用 TS，但 Hono 提供的 `hc` 客户端会更优雅地处理类型定义和调用 API。

## 碎碎念

~~国外的服务器真的慢死了...现在好后悔不用传统的express来自己搭建后端~~