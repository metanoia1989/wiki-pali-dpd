/**
 * 预设提示词 — 巴利语/佛教文本分析场景。
 * 用户点击后自动拼接到选中文本前发送给 DeepSeek。
 */
export const PRESETS = [
    {
        id: "grammar",
        label: "语法分析",
        icon: "📖",
        prompt: "请分析这个巴利语单词的语法：说明它的变格/变位、格、数、性、人称，以及连音变化（sandhi），用中文回答。"
    },
    {
        id: "meaning",
        label: "释义详解",
        icon: "📝",
        prompt: "请解释这个巴利语单词的含义，给出用法说明。"
    },
    {
        id: "compound",
        label: "复合词拆解",
        icon: "🔍",
        prompt: "请分析这个巴利语复合词：拆解为组成部分，说明涉及的连音规则（sandhi），用中文回答。"
    },
    {
        id: "etymology",
        label: "词源分析",
        icon: "🌱",
        prompt: "请分析这个巴利语词汇的词源，包括词根、前缀、后缀，以及相关的梵语同源词。请用中文回答。"
    },
    {
        id: "translate",
        label: "翻译",
        icon: "🌐",
        prompt: "请将这个巴利语词汇或短语翻译为中文，并解释其在佛经中的用法。请用中文回答。"
    },
];
