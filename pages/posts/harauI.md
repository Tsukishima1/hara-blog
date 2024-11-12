---
title: 组件库搭建小记🐥
date: 2024-10-29
description: 用 Dumi 的组件库框架搭建一个组件库的小记，主要是组件的编写过程记录
tag: hara-ui, 项目
author: Xayah
---

## Tooltip 文字提示
+ 使用 React 中的 `FC<PropsWithChildren<TooltipProps>>` 构建组件基本结构，表示它是一个 React 函数组件，接受的属性包括 TooltipProps 中定义的属性，以及一个可选的 `children` 属性，确保属性类型安全。
+ 组件接收一个位置参数 `position` 设置表示位置的类名，例如 `hara-tooltip-left` 来处理不同方向下组件的样式。
+ 使用 `useState` 钩子监视 `visible` 来管理显示和隐藏的状态，通过 ` onMouseEnter ` 和 ` onMouseLeave ` 鼠标进入和离开的事件处理函数：进入时 `setVisible(true)` / ... 然后根据 visible 的值进行条件渲染判断显示和隐藏
![Local Image](../../public/images/tooltip01.png)

## Select 选择器
因为不只是使用一个组件就可以完成的，所以使用多组件的结构来搓
```html
<Select>
	<SelectTrigger></SelectTrigger>
	<SelectContent>
	    <SelectItem></SelectItem>
	</SelectContent>
</Select>
```
SelectTrigger 用来存放点击触发器中的内容如“选择一个选项”，SelectContent 用来存放各个选项即 SelectItem ，其中通过上下文（`Context`）来管理状态和交互。

其中上下文结构由 `SelectContextProps` 定义，包括是否打开下拉菜单、选中标签和值、切换菜单的打开状态以及选择选项时的回调：
```js
const SelectContext = createContext<SelectContextProps|undefined>(undefined)
```
### SelectTrigger
`SelectTrigger` 组件是下拉菜单的触发器按钮，它使用 `useContext` 来获取上下文，并根据菜单的状态应用不同的样式（选中或者未选中），点击触发器按钮时触发上下文的 `toggleOpen` 函数切换菜单状态，如果后边 **选择了选项则会展示选项内容（组件重新渲染了**

会重新渲染的原因：
选择选项触发的 `onSelect` 中有 `setSelectedValue` 等更新状态的函数，主组件 Select 的状态发生变化的话就会重新渲染真个组件结构包括 trigger ~
### SelectContent
`SelectContent` 组件用于显示下拉菜单的内容，获取上下文根据其中的菜单状态选择是否展示选项
### SelectItem
`SelectItem` 组件表示下拉菜单中的一个选项，获取上下文根据选项是否被选中展示不同的样式（勾勾）点击选项时触发上下文的 `onSelect` 选择该选项，并根据使用 `Select` 组件时是否定义了 `onChange` 来处理选择的选项内容~

## 实现深浅主题切换
一开始直接用的是 `@media(prefers-color-schema='dark') {}` 媒体查询的形式一个个写组件们的深色样式，结果发现没有生效，之后才发现原来这是**直接判断目前系统深浅主题**的功能啊喂！Σ(っ °Д °;)っ

再之后用开发者工具看框架中深浅主题标签的变化，发现 `html` 中有一个属性叫 `data-theme`，切换主题该值会切换，突然回想起来之前写小项目时做过类似的功能，加上对 `ShadcnUI` 的研究，切换可选的话应该有 `system` | `light` | `dark` 三种选项，如果选 `system` 的话就要分析当前系统的主题然后再在 `light` 和 `dark` 之中选一个，有了大概的思路：

**创建一个上下文用提供者组件 `ThemeProvider` 包裹住 ` App `，用于管理和应用主题颜色**

提供者应接收一个必选的 `children` 即子组件，两个可选的 `defaultTheme` 和 `storageKey`，后者负责直接从本地存储取得符合的主题类型
```tsx
type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};
```

`ThemeProviderState`：表示上下文状态，包括当前主题和设置主题的函数
```tsx
type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};
```

初始化状态并创建上下文
```tsx
const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
```

定义该组件
```tsx
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "haraui-theme",
  ...props
}: ThemeProviderProps) {
	const [theme,setTheme] = useState<Theme>(
	    ()=>(localStorage.get(storageKey) as Theme) || defaultTheme
	)
	// 使用useState钩子初始化主题状态，优先从localStorage获取主题，否则使用默认主题。

	const value= {...}
	// 此value为上下文值，返回组件中传递给子组件

	return (
	    <ThemeProviderContext.Provider {...props} value={value}>
	        {children}
	    </ThemeProviderContext.Provider>
	)
}
```

在其中使用 `useEffect` 钩子在组件挂载和主题变化时应用主题，根据当前主题设置 `data-theme` 属性！
```tsx
useEffect(() => {
const root = window.document.documentElement;

const applyTheme = (currentTheme: Theme) => {
  if (currentTheme === "system") {
    const systemTheme = 
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    root.setAttribute("data-theme", systemTheme);
  } else {
    root.setAttribute("data-theme", currentTheme);
  }
};

applyTheme(theme);

// 如果当前主题是"system"，则添加监听器以检测系统主题变化，并在变化时更新主题。返回一个清理函数以在组件卸载时移除监听器。
if (theme === "system") {
    const systemThemeListener = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? "dark" : "light");
    };
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", systemThemeListener);

    return () => {
      mediaQuery.removeEventListener("change", systemThemeListener);
    };
  }
}, [theme]);
```

定义 `useTheme` 钩子给组件用（切换按钮）
```tsx
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
```

轮到使用的时候就把 `ThemeProvider` 包在 App 外边，然后在切换按钮的那个组件使用 useTheme 实例化提取出 `theme` 获取当前值和 `setTheme` 修改值就好了!!!

之后就是关于样式咋写的问题，一个个在组件的 css 文件写有点太乱了，全都要 `[data-theme='dark'] ... {...}`，然后！终于想通为什么很多项目都有各种 css 参数例如 `--tailwind-ring` ，我完全可以把会变动的都写在 variable.css 文件里面，大致就是如此：
![Local Image](../../public/images/haraui-variablecss.png)

