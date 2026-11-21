# 正式评阅结果 JSON 文件字段说明

## 一、整体结构

```
[                                   ← 数组：一位考生一个元素
  {
    "id": "考生考号",
    "total_score": 整卷总分,
    "result": [                     ← 大题数组：按卷面大题顺序
      {
        "question":  大题题干,
        "answer":    大题级答案文件（大题级一般为空）,
        "images":    该题对应的空白卷参考图,
        "score":     大题得分,
        "comment":   大题级复核说明,
        "sub_question": [ 小题数组，字段含义与大题相同 ]
      },
      ...
    ]
  },
  ...
]
```

## 二、完整示例（一名考生）

```jsonc
[
  {
    "id": "33A31003125A3301645",          // 考生考号
    "total_score": 77,                    // 整卷总分 = 下列各大题 score 之和（29+22+8+18）
    "result": [
      {
        "question": "（一）数字媒体素材制作（必做题，共2题，共35分）",   // 大题题干（含分值说明）
        "answer": "",                     // 大题级不放答案文件，一般为空
        "images": [],                     // 大题级参考图（无则空数组）
        "score": 29,                      // 本大题得分 = 该大题各小题得分之和（6+23）
        "comment": "",                    // 大题级复核说明：无复核项时为空，见「五、怎么找复核题」
        "sub_question": [
          {
            "question": "1．音频制作（本题10分）……",     // 小题题干
            "answer": "AuditionA.sesx",                 // 考生本题抽取到的答案结果文件名
            "images": ["media/blank_paper/blank_001.png"], // 本题空白卷参考图
            "score": 6,                                 // 本小题得分
            "comment": "新建会话与素材导入：扣 1 分，会话参数中……", // 机器评分说明：逐项给分/扣分理由
            "sub_question": []           // 小题固定为空数组
          },
          {
            "question": "2．图像制作（本题25分）……",
            "answer": "PicA.jpg",
            "images": ["media/blank_paper/blank_002.png"],
            "score": 23,
            "comment": "2. 素材合成（5 分）：扣 1 分，……需人工复核：……", // 含「需人工复核」表示该项待人工确认
            "sub_question": []
          }
        ]
      },
      {
        "question": "（三）动画与虚拟现实制作（Animate、3ds Max、Unity3D 三选一，本题20分）",
        "answer": "",
        "images": [],
        "score": 8,
        "comment": "",                   // 没交文件记 0 分的大题不会带复核内容
        "sub_question": [
          {
            "question": "1. 二维动画制作……",
            "answer": "",                // 该小题未抽取到答案文件
            "images": [],
            "score": 0,
            "comment": "考生未选做本小题（实际选做 Unity数字媒体集成开发），按标准记 0 分。",
            "sub_question": []
          },
          {
            "question": "3．Unity数字媒体集成开发……",
            "answer": "UnityA",          // 考生选做方向有答案文件
            "images": ["media/blank_paper/blank_004.png"],
            "score": 8,
            "comment": "1. 新建工程、模板与素材导入：扣 1 分，……",
            "sub_question": []
          }
        ]
      }
      // （二）（四）大题结构同上，此处省略
    ]
  }
]
```

## 三、字段含义一览

| 字段 | 层级 | 含义 |
|---|---|---|
| `id` | 考生 | 考生考号，与系统内考号一致 |
| `total_score` | 考生 | 整卷总分（各大题 `score` 相加，保留两位小数） |
| `result` | 考生 | 大题数组，按卷面大题顺序排列 |
| `question` | 大题/小题 | 题干原文（大题含「必做题/选做、共 X 分」说明） |
| `answer` | 大题/小题 | 考生本题抽取到的**答案结果文件名**；多个文件用「；」分隔；**空字符串 = 未抽取到该题的答案文件（一般即未提交）** |
| `images` | 大题/小题 | 本题对应的空白卷参考图片路径（`media/blank_paper/…`），无则为 `[]` |
| `score` | 大题/小题 | 得分。小题 `score` 之和 = 所属大题 `score`；各大题 `score` 之和 = `total_score` |
| `comment` | 大题 | **复核说明**：本题各小题评分服务返回的需人工复核内容，格式 `Q题号：内容`，多条用「；」分隔；空 = 本大题无复核项 |
| `comment` | 小题 | **机器评分说明**：逐项给分/扣分的理由 |
| `sub_question` | 大题/小题 | 该题下的小题数组；小题的 `sub_question` 固定为 `[]` |
