# 开发者开发过程中的记录

## 配置问题
每次构建，如果有新增词典数据，数据包需要更新版本号（数据包文件名中包含），脚本更新版本号（脚步元信息）。
用单独一个json包含最新的数据包版本?
这样油猴才知道是否更新了（或者有明确的机制），能够提示用户更新，在设置弹窗，能够检测到数据更新，能够进行更新操作
这点蛮重要的。

这个版本号应该放到单独的一个配置文件，方便修改 

关于数据包链接，也要抽到配置文件里，并且允许在设置页面编辑。 

第一个分析表的长度
第二个展示的单词数
是否默认显示查询结果
如果否的话，就一个图标 加上一行点击显示的提示
点击就会在下方显示查询结果 

或者将结果追加到 dpd 解析里？ 

## 单词拆解 [OK]
对于复合词，没有拆解。
普通词条，例如 sādhu 1
adj. good; pleasant; auspicious [√sādh + u] ✔
Grammar	adj
Root Family	√sādh
Root	√sādh･3 ya (accomplish)
Construction	√sādh + u
Grammer有了，词根familly和词根以及拆解都没有，原 dpd-db 是怎么做到的呢？ 

## 多个词条 [OK]
一个单词有多个词条，查询时没有展示出来，只展示了一个。
词条展示条 就 词头 词性 词义(限制长度，超出用...)，展开标示(不要加dpd，空间非常有限)
展开的内容，以词性+词义+拆解
表格如果超出宽度，应该有横向滚动条允许拖动看

在这些词条前加一个可能的曲折变化计算，像下面这样 
sa
pos ⇅	⇅	⇅	⇅		word ⇅
pron	masc	nom	sg	of	ta
letter	masc	voc	sg	of	sa
adj	masc	voc	sg	of	sa
adj	nt	voc	sg	of	sa
noun	masc	voc	sg	of	sa

