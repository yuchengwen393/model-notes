## 从矩阵形状开始

第二天的任务是把 Transformer 的骨架写出来。教材里的公式看起来不复杂，真正动手时，最先卡住的往往是形状：`[batch, seq_len, hidden]` 经过每一层之后，到底变成了什么。

### 多头注意力

一个头的注意力可以写成：

> Attention(Q, K, V) = softmax(QKᵀ / √d) V

多头则是把 hidden 维切成若干份，各自计算，再拼接回来。写代码时最重要的是三件事：

- Q、K、V 的线性层不要带 bias；
- 因果掩码必须是上三角为负无穷，保证第 t 个 token 只能看见 1..t；
- softmax 要按最后一维做，缩放因子是 `1 / sqrt(head_dim)`。

~~~python
attn = (q @ k.transpose(-2, -1)) / math.sqrt(head_dim)
attn = attn.masked_fill(mask, float("-inf"))
attn = F.softmax(attn, dim=-1)
out = attn @ v
~~~

### RoPE、RMSNorm 与 SwiGLU

为了让模型能处理位置信息，用了 RoPE：不是给 token 加位置向量，而是把 Q、K 的每一对维度当成二维平面旋转，旋转角度由位置决定。这样注意力分数天然携带相对位置。

归一化用 RMSNorm，只做缩放不做平移，比 LayerNorm 少一些参数；前馈网络用 SwiGLU，两个线性层加一个门控。

### KV Cache

推理时如果每生成一个 token 都把整段重新算一遍，代价会随长度平方增长。KV Cache 把每一层已经算过的 K、V 存下来，下一步只输入新 token。训练时不需要，推理时必须开。

### 拼成一个模型

最终配置是 8 层、768 维、12 个注意力头、词表 6400，参数量约 6391 万。它还不聪明，但前向传播、loss 计算、generate 循环都能跑通。

> 手写一遍的价值不在于复刻一个更好的模型，而在于之后看到任何架构图，都知道它是怎么落到张量上的。
