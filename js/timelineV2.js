var tl = new TimelineBar(d3.select('#timelineBox').node());
var menuTimer = null;
var dragTimer = null;

function switchScope(flag) {
    flag ? tl.showSelect() : tl.hideSelect();
}

function clearChange() {
    tl.clearBrush();
}

var timeLineCache = new Map();
var updateCache = new Map();

/**
 * 绘制时间轴关系图
 * @param {Number} companyId 
 */
function initCanvas(companyId) {

    var NODE_STYLE = {
        Human: {
            r: 30,
            fill: 'rgb(255, 150, 107)',
            stroke: 'rgb(247, 115, 62)'
        },
        Company: {
            r: 40,
            fill: 'rgb(8, 147, 228)',
            stroke: 'rgb(7, 117, 180)'
        }
    }

    const RELATION_COLOURS = {
        TELPHONE: 'rgb(1, 194, 106)',
        SERVE: 'rgb(106, 220, 254)',
        INVEST_H: 'rgb(141, 149, 250)',
        INVEST_C: 'rgb(141, 149, 250)',
        OWN: 'rgb(249, 225, 105)',
        BANK: 'rgb(227, 166, 0)',
        HOUSEHOLD_A: 'rgb(176, 114, 208)',
        HOUSEHOLD_B: 'rgb(176, 114, 208)'
    };

    toggleMask(true);

    // mock 数据公司 id:
    // 372950       河北信息产业股份有限公司
    // 94694333     河北华为通信技术有限责任公司
    // 94694335     河北省电话设备厂
    // 116035781    深圳华远电信有限公司
    // 112520475    香港昌兴公司

    var relLabels = ['SERVE', 'INVEST_C', 'INVEST_H', 'OWN', 'TELPHONE', 'BANK', 'HOUSEHOLD_A', 'HOUSEHOLD_B'];
    companyId = 372950;
    COMPANY_ID = companyId;

    // var url = '../js/config/data/timeline.json';
    // var url = api('getTimeLine', {
    //     companyId: COMPANY_ID
    // });

    var url = './data/relations.final.json';
    // var url = './data/relations.init.json';

    // var url = './data/sub/relations.busine.json';
    // var url = './data/sub/relations.bank.json';
    // var url = './data/sub/relations.contact.json';
    // var url = './data/sub/relations.household.json';

    var ticking = false;
    var isDraging = false;
    var isHoverNode = false;
    var isHoverLine = false;
    var isBrushing = false;
    var flowAnim = new FlowAnim();

    var width = d3.select('#graph-main').node().clientWidth;
    var height = d3.select('#graph-main').node().clientHeight;

    // 节点笔刷比例尺 - 设置大于可见宽高，避免全屏后右边及下边选取不到
    var xScale = d3.scale.linear()
        .domain([0, width * 2])
        .range([0, width * 2]);

    var yScale = d3.scale.linear()
        .domain([height * 2, 0])
        .range([height * 2, 0]);

    // 节点笔刷
    var d3brush = d3.svg.brush()
        .x(xScale)
        .y(yScale)
        .extent([
            [0, 0],
            [0, 0]
        ]);

    var force = d3.layout.force()
        .size([width, height])
        .linkDistance(180)
        .charge([-1800])
        .on('start', () => ticking = true)
        .on('tick', tick)
        .on('end', () => ticking = false);


    var drag = force.drag()
        .on('dragstart', dragstart)
        .on('drag', draging)
        .on('dragend', dragend);

    var zoom = d3.behavior.zoom()
        .scaleExtent([0.25, 2])
        .on('zoom', zoomFn);

    var svg = d3.select('#graph-main').append('svg')
        .attr('class', 'svgCanvas')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .call(zoom)
        .on('dblclick.zoom', null);

    // const zoomOverlay = svg.append('rect')
    //     .attr('class', 'zoom-overlay hidden');

    const container = svg.append('g')
        .attr('class', 'container');

    var brushRect = container.append('g')
        .attr('class', 'brush-rect');

    var links = container.append('g').attr('class', 'links-group').selectAll('.link');
    var rLine = links.selectAll('.r-line');
    var rText = links.selectAll('.r-text');

    var nodes = container.append('g').attr('class', 'nodes-group').selectAll('.node');
    var nCircle = nodes.selectAll('.n-circle');
    var nText = nodes.selectAll('.n-text');
    var selectedHalo = nodes.selectAll('.n-halo');

    var markers = container.append('svg:defs').selectAll('.marker')
        .data(relLabels).enter()
        .append('svg:marker')
        .attr({
            id: d => d,
            class: 'marker',
            markerUnits: 'strokeWidth',
            markerWidth: '12',
            markerHeight: '12',
            viewBox: '0 0 12 12',
            refX: '7',
            refY: '4',
            orient: 'auto'
        })
        .style('fill', d => RELATION_COLOURS[d])
        .append('path')
        .attr('d', 'M2,2 L8,4 L2,6 L3,4 L2,2');

    // 数据流小球比例尺
    var flowScale = d3.scale.linear().range([4, 8]);

    /** 
     * 获取画图数据 && 绘图
     */
    var graph = timeLineCache.get(url);
    if (graph) {
        // --> 渲染力学图
        requestAnimationFrame(function () {
            renderFroce(graph);
        });
    } else {
        d3.json(url, function (error, graph) {
            if (error) {
                toggleMask(false);
                return console.error(error);
            }
            if (typeof graph === 'string') {
                try {
                    graph = JSON.parse(graph);
                } catch (error) {
                    toggleMask(false);
                    console.error('无法解析 JOSN 格式！', url);
                    return;
                }
            }
            timeLineCache.set(url, graph);

            // // --> 1. 绘制时间轴工具条
            // renderBar(graph);

            // --> 2. 绘制关系图 
            renderFroce(graph);
        });
    }


    /**
     * 渲染图像：时间轴工具条 + 关系图
     * @param {Object} graph 
     */
    function renderFroce(graph) {
        // 生成力学图数据
        var { nodes_data, edges_data } = genForeData(graph);
        // console.log('更新前_nodes：', nodes_data);
        // console.log('更新前_edges：', edges_data);

        // 绑定力导向图数据，开启力学计算
        force
            .nodes(nodes_data)
            .links(edges_data)
            .start();

        // 强制停止力学布局
        setTimeout(function () {
            force.stop();
        }, 3000);

        // 关系分组
        links = links
            .data(edges_data, d => d.source.id + '-' + d.target.id)
            .enter().append('g')
            .attr('class', 'link')
            .each(function (link) {
                var lineG = d3.select(this);
                var lineEnter = lineG.selectAll('line')
                    .data(link.lines, d => d.id)
                    .enter();

                // 关系连线
                rLine = lineEnter.append('line')
                    .attr('class', 'r-line')
                    .attr('stroke', d => RELATION_COLOURS[d.type])
                    .attr('marker-end', d => 'url(#' + d.type + ')');

                // 关系文字
                rText = lineEnter.append('text')
                    .attr('class', 'r-text')
                    .text(function (d) {
                        return d.label;
                    });
            });

        links
            .on('mouseenter', function () {
                isHoverLine = true;
            })
            .on('mouseleave', function () {
                isHoverLine = false;
            });

        // 节点分组
        nodes = nodes
            .data(nodes_data, d => d.id)
            .enter().append('g')
            .attr('class', 'node')
            // .style('fill-opacity', .2)
            .each(function (d) {
                var nodesG = d3.select(this);
                nodesG.classed(d.ntype, true);
                d.selected = false;
                d.previouslySelected = false;
                d.r = NODE_STYLE[d.ntype].r;

                // 节点圆形
                nCircle = nodesG.append('circle')
                    .attr('class', 'n-circle')
                    .attr(NODE_STYLE[d.ntype])
                    .classed('curr', d => d.id === COMPANY_ID);

                // 节点文字
                nText = nodesG.append('text')
                    .attr('class', 'n-text')
                    .attr('y', d => {
                        const len = d.name.length;
                        return len > 9 ? '-2.3em' : (len <= 4 ? '-1em' : '-1.6em');
                    })
                    .each(d => {
                        const context = d3.select(this).select('text');
                        const paragraphs = getParagraphs(d.name);
                        context
                            .selectAll('tspan')
                            .data(paragraphs)
                            .enter()
                            .append('tspan')
                            .attr({
                                x: 0,
                                dy: '1.4em'
                            })
                            .text(d => d);
                    });
            });

        nodes
            .on('mouseenter', function (d) {
                if (isDraging) {
                    return;
                }
                isHoverNode = true;
                if (!isBrushing) {
                    d3.select(this).select('circle').transition().attr('r', 8 + NODE_STYLE[d.ntype].r);
                }
            })
            .on('mouseleave', function (d) {
                if (isDraging) {
                    return;
                }
                isHoverNode = false;
                d3.select(this).select('circle').transition().attr('r', NODE_STYLE[d.ntype].r);
            })
            .on('dblclick', function (d) {
                d3.select(this).classed('fixed', d.fixed = false);
                d.open ? closeNR([d.id], graph) : openNR([d.id], graph);
            })
            .call(drag);

        // 数据流小球比例尺
        flowScale = setFlowScale(graph);

        // 选中画布范围
        brushHandle(graph);

        // 关闭 loading 动画
        requestAnimationFrame(function () {
            toggleMask(false);
        });

    } // renderFroce end 

    /**
     * 更新关系图
     * @param {Object} graph   
     */
    function update(graph, ids) {

        if (!graph || !ids) {
            return;
        }

        // // --> 1. 更新时间轴工具条
        // renderBar(graph);

        // --> 2. 更新时间关系图
        // 更新力学图数据
        var { nodes_data, edges_data } = genForeData(graph);
        // console.log('更新后_nodes：', nodes_data);
        // console.log('更新后_edges：', edges_data);

        // 更新关系（连线）
        links = links.data(edges_data, d => d.source.id + '-' + d.target.id);
        links.exit().remove();

        // 更新主体（节点）
        nodes = nodes.data(nodes_data, d => d.id);
        nodes.exit().remove();

        // 绑定力导向图数据，开启力学计算
        force
            .nodes(nodes_data)
            .links(edges_data)
            .start();

        // 关系分组
        links.enter().append('g')
            .attr('class', 'link')
            .each(function (link) {
                var lineG = d3.select(this);
                var lineEnter = lineG.selectAll('line')
                    .data(link.lines, d => d.id)
                    .enter();

                // 关系连线
                rLine = lineEnter.append('line')
                    .attr('class', 'r-line')
                    .attr('stroke', d => RELATION_COLOURS[d.type])
                    .attr('marker-end', d => 'url(#' + d.type + ')');

                // 关系文字
                rText = lineEnter.append('text')
                    .attr('class', 'r-text')
                    .text(function (d) {
                        return d.label;
                    });
            });

        links
            .on('mouseenter', function () {
                isHoverLine = true;
            })
            .on('mouseleave', function () {
                isHoverLine = false;
            });

        // 节点分组
        nodes.enter()
            .append('g')
            .attr('class', 'node')
            // .style('fill-opacity', .2)
            .each(function (d) {
                var nodesG = d3.select(this);
                nodesG.classed(d.ntype, true);
                d.selected = false;
                d.previouslySelected = false;
                d.r = NODE_STYLE[d.ntype].r;

                // 节点圆形
                nCircle = nodesG.append('circle')
                    .attr('class', 'n-circle')
                    .attr(NODE_STYLE[d.ntype])
                    .classed('curr', d => d.id === COMPANY_ID);

                // 节点文字
                nText = nodesG.append('text')
                    .attr('class', 'n-text')
                    .attr('y', d => {
                        const len = d.name.length;
                        return len > 9 ? '-2.3em' : (len <= 4 ? '-1em' : '-1.6em');
                    })
                    .each(d => {
                        const context = d3.select(this).select('text');
                        const paragraphs = getParagraphs(d.name);
                        context
                            .selectAll('tspan')
                            .data(paragraphs)
                            .enter()
                            .append('tspan')
                            .attr({
                                x: 0,
                                dy: '1.4em'
                            })
                            .text(d => d);
                    });
            });

        nodes
            .on('mouseenter', function (d) {
                if (isDraging) {
                    return;
                }
                isHoverNode = true;
                if (!isBrushing) {
                    d3.select(this).select('circle').transition().attr('r', 8 + NODE_STYLE[d.ntype].r);
                }
            })
            .on('mouseleave', function (d) {
                if (isDraging) {
                    return;
                }
                isHoverNode = false;
                d3.select(this).select('circle').transition().attr('r', NODE_STYLE[d.ntype].r);
            })
            .on('dblclick', function (d) {
                d3.select(this).classed('fixed', d.fixed = false);
                d.open ? closeNR([d.id], graph) : openNR([d.id], graph);
            })
            .call(drag);

        // 数据流小球比例尺
        flowScale = setFlowScale(graph);

        // 关闭 loading 动画
        requestAnimationFrame(function () {
            toggleMask(false);
        });

    }

    /**
     * 生成力学图数据
     * @param {Object} graph 
     */
    function genForeData(graph) {
        if (!graph) {
            return { nodes_data: [], edges_data: [] };
        }

        const nodesMap = graph.nodes.reduce(function (map, curr) {
            if (!map[curr.id]) {
                map[curr.id] = curr;
            }
            return map;
        }, {});

        const linesMap = {}; // 关系连线 -- 两个节点间可以有多条连线

        const relsMap = graph.relations.reduce(function (map, curr) {
            const { startNode, endNode, id } = curr;

            const k = [startNode, endNode];
            if (nodesMap[startNode] && nodesMap[endNode]) {
                if (!map[k]) {
                    map[k] = {
                        lines: []
                    };
                };
                if (!linesMap[id]) { // 连线去重
                    linesMap[id] = curr;
                    map[k].lines.push(curr);
                }
            }
            return map;
        }, {});

        // 节点去重
        graph.nodes = [...Object.values(nodesMap)];

        // 关系去重
        graph.relations = Object.values(relsMap).reduce(function (rels, { lines }) {
            return [...rels, ...lines];
        }, []);

        // 构建 force 数据
        const nodes_data = [...graph.nodes];
        const edges_data = Object.entries(relsMap).reduce(function (edges, [k, v]) {
            const [startNode, endNode] = k.split(',');
            if (nodesMap[startNode] && nodesMap[endNode]) {

                // 尝试解决：循环关系重合为双向箭头问题
                const hasReverse = edges.some(({ source, target, lines }) => {
                    return (+endNode === +source.id && +startNode === +target.id);
                });
                if (hasReverse) {
                    for (const { source, target, lines } of edges) {
                        if (+endNode === +source.id && +startNode === +target.id) {
                            lines.unshift(...relsMap[k].lines);
                        }
                    }
                } else {
                    edges.push({
                        source: nodesMap[startNode],
                        target: nodesMap[endNode],
                        lines: relsMap[k].lines
                    });
                }

                // edges.push({
                //     source: nodesMap[startNode],
                //     target: nodesMap[endNode],
                //     lines: relsMap[k].lines
                // });
            }
            return edges;
        }, []);

        // console.log(edges_data);

        // getDirectRelsById(0, graph.relations, nodesMap);
        // getRelsByType([], graph.relations, nodesMap);
        // getRelsBetweenIds([], graph.relations, nodesMap);

        return { nodes_data, edges_data };
    }

    // 获取直接关系
    function getDirectRelsById(nodeId, useableRels, nodesMap) {
        // mock 数据公司 id:
        // 372950       河北信息产业股份有限公司
        // 94694333     河北华为通信技术有限责任公司
        // 94694335     河北省电话设备厂
        // 112520475    香港昌兴公司
        // 116035781    深圳华远电信有限公司
        nodeId = 116035781;

        const uniqueMap = new Map();
        const directRels = useableRels.reduce(function (rels, curr) {
            const { relations, nodes } = rels;
            const { startNode, endNode } = curr;
            if (startNode === nodeId || endNode === nodeId) {
                relations.push(curr);
                if (!uniqueMap.has(startNode) /*&& (startNode !== nodeId)*/) {
                    nodes.push(nodesMap[startNode]);
                    uniqueMap.set(startNode, 1);
                }
                if (!uniqueMap.has(endNode) /*&& (endNode !== nodeId)*/) {
                    nodes.push(nodesMap[endNode]);
                    uniqueMap.set(endNode, 1);
                }
            }
            return rels;
        }, { relations: [], nodes: [] });

        console.log(JSON.stringify(directRels));

        return directRels;
    }

    // 获取指定类型的关系
    function getRelsByType(rType, useableRels, nodesMap) {
        // ['SERVE', 'INVEST_C', 'INVEST_H', 'OWN', 'TELPHONE', 'BANK', 'HOUSEHOLD_A', 'HOUSEHOLD_B'];
        // rType = ['SERVE', 'INVEST_C', 'INVEST_H', 'OWN'];
        rType = ['BANK', 'TELPHONE'];
        const uniqueMap = new Map();
        const typeRels = useableRels.reduce(function (rels, curr) {
            const { relations, nodes } = rels;
            const { startNode, endNode, type } = curr;
            if (rType.includes(type)) {
                relations.push(curr);
                if (!uniqueMap.has(startNode) /*&& (startNode !== nodeId)*/) {
                    nodes.push(nodesMap[startNode]);
                    uniqueMap.set(startNode, 1);
                }
                if (!uniqueMap.has(endNode) /*&& (endNode !== nodeId)*/) {
                    nodes.push(nodesMap[endNode]);
                    uniqueMap.set(endNode, 1);
                }
            }
            return rels;
        }, { relations: [], nodes: [] });

        console.log(JSON.stringify(typeRels));

        return typeRels;
    }

    // 获取多节点之间关系
    function getRelsBetweenIds(nodeIds, useableRels, nodesMap) {
        // 1000055424 // 张凯
        // 1000054620 // 李虹
        // 1000572142 // 陈朝
        nodeIds = [1000055424, 1000054620, 1000572142];
        const nodesArr = permutation(nodeIds);
        const uniqueMap = new Map();
        const directRels = useableRels.reduce(function (rels, curr) {
            const { relations, nodes } = rels;
            const { startNode, endNode } = curr;
            for (const [n1, n2] of nodesArr) {
                if ((startNode === n1 && endNode === n2) || (startNode === n2 && endNode === n1)) {
                    relations.push(curr);
                    if (!uniqueMap.has(startNode)) {
                        nodes.push(nodesMap[startNode]);
                        uniqueMap.set(startNode, 1);
                    }
                    if (!uniqueMap.has(endNode)) {
                        nodes.push(nodesMap[endNode]);
                        uniqueMap.set(endNode, 1);
                    }
                }
            }
            return rels;
        }, { relations: [], nodes: [] });

        console.log(JSON.stringify(directRels));

        return directRels;
    }

    /**
     * 绘制时间轴工具条
     * @param {Object} graph 
     */
    function renderBar(graph) {
        // --> 1. 绘制时间轴工具条
        var barMap = {};
        if (graph.relations) {
            graph.relations.forEach(function (d) {
                barMap[d.starDate] = barMap[d.starDate] ? barMap[d.starDate] + 1 : 1;
            });
        }

        var barData = [];
        for (var k in barMap) {
            barData.push({
                at: new Date(k),
                value: barMap[k],
                type: 'bar'
            });
        }

        // 时间轴工具条配置
        var barSetting = {
            fn: {
                // 拖动时间轴工具条笔刷，更新关系图数据
                onBrush: function (startTime, endTime) {
                    if (startTime === endTime) {
                        edges_data.forEach(function (link) {
                            link.lines.forEach(function (ln) { ln.disuse = false; });
                            link.source.filter = false;
                        });
                    } else {
                        edges_data.forEach(function (link) {
                            link.lines.forEach(function (ln) {
                                var time = new Date(ln.starDate).getTime();
                                ln.disuse = !(time > startTime && time < endTime);
                            });
                            link.source.filter = !link.lines.filter(function (d) {
                                return !d.disuse
                            }).length;
                        });
                    }
                    // 根据时间轴范围变化，筛选关系（修改样式）
                    slideTimeline();
                }
            },
            height: 80,
            zoom: [0.5, 0.5],
            startZoom: 0.5
            // ,enableLiveTimer: true
        };

        tl.renderTimeBar([{
            label: 'bar',
            data: barData
        }], barSetting);

        switchScope(true);
        document.querySelector('#scope').querySelector('input').checked = true;
    }

    /**
     * 设置数据流小球比例尺
     * @param {Object} graph 
     */
    function setFlowScale(graph) {
        var amoutList = [];
        graph.relations.forEach(function (d) {
            if (d.amout) {
                amoutList.push(d.amout);
            }
        });
        return flowScale.domain(d3.extent(amoutList));
    }
    /**
     * 选中画布范围
     */
    function brushHandle(graph) {
        d3brush
            .on('brushstart', brushstartFn)
            .on('brush', brushFn)
            .on('brushend', brushendFn)

        brushRect.call(d3brush)
            .selectAll('rect')
            .style('fill-opacity', 0.3);

        // 选中聚焦环
        selectedHalo = nodes.append('circle')
            .attr('r', function (d) { return NODE_STYLE[d.ntype].r + 5; })
            .attr('class', 'n-halo')
            .attr('id', function (d) { return 'halo-' + d.id; })
            .style('fill', 'rgba(0,0,0,.0)')
            .style('stroke', 'rgb(0,209,218)')
            .style('stroke-width', 4)
            .classed('hidden', true);

        // 隐藏选中聚焦环
        var hideSelectedHalo = function () {
            selectedHalo.classed('hidden', true);
            nodes.each(function (d) { d.selected = false; });
        }

        // 关闭菜单
        var hideCircleMenu = function () {
            svg.select('#circle_menu').remove();
        }

        // 框选刷
        function brushstartFn() {
            isBrushing = true;
            hideCircleMenu();
            if (d3.event.sourceEvent.type !== 'brushend') {
                hideSelectedHalo();
            }
        }

        function brushFn() {
            isBrushing = true;
            if (d3.event.sourceEvent.type !== 'brushend') {
                var selection = d3brush.extent();
                var xmin = selection[0][0];
                var xmax = selection[1][0];
                var ymin = selection[0][1];
                var ymax = selection[1][1];
                nodes.each(function (d) {
                    var x0 = d.x - d.r;
                    var x1 = d.x + d.r;
                    var y0 = d.y - d.r;
                    var y1 = d.y + d.r;
                    //如果节点的坐标在选择框范围内，则被选中
                    var selected = selection != null && (xmin <= x0 && xmax >= x1 && ymin <= y0 && ymax >= y1);
                    d.selected = d.previouslySelected ^ selected;
                });
            }
        }

        function brushendFn() {
            isBrushing = false;
            var ids = [];
            if (d3brush.extent() != null) {
                d3.select(this).select('rect.extent').attr({
                    width: 0,
                    height: 0,
                    x: 0,
                    y: 0
                });
                nodes.each(function (d) {
                    if (d.selected) {
                        ids.push(d.id);
                    }
                    d3.select('#halo-' + d.id).classed('hidden', !d.selected);
                });

                // 圆形菜单
                var isMulti = ids.length > 1;
                var mouse = d3.mouse(this);
                var closeMenu = function () {
                    hideCircleMenu();
                    hideSelectedHalo();
                }

                if (ids.length > 0) {
                    hideCircleMenu();

                    //控制显示菜单
                    var circleMenu = d3.select('.container').append('foreignObject')
                        .attr('id', 'circle_menu')
                        .attr('width', 128)
                        .attr('height', 128)
                        .attr('x', mouse[0] - 64)
                        .attr('y', mouse[1] - 64)
                        .html(function () {
                            var html = `` + `
                        <div class="menu-circle">
                            <div class="menu-ring ${isMulti ? 'multiple-menu' : 'single-menu'}">
                                <a class="menuItem fa fa-share-alt icon-white"></a>
                                <!--<a id="menu_btn_findRelations" class="menuItem fa fa-search icon-white multiple-btn"></a>-->
                                <a id="menu_btn_findDeepRelations" class="menuItem fa fa-search-plus icon-white multiple-btn"></a>
                                <a id="menu_btn_trash" class="menuItem fa fa-trash icon-white "></a>
                                <a id="menu_btn_toggleSelection" class="menuItem fa fa-th-list icon-white single-btn"></a>
                                <a id ="menu_btn_closeNodeRelations" class="menuItem fa fa-compress icon-white single-btn"></a>
                                <a id ="menu_btn_openNodeRelations" class="menuItem fa fa-expand icon-white single-btn"></a>
                                <a id="menu_btn_refresh" class="menuItem fa fa-refresh icon-white multiple-btn"></a>
                            </div>
                            <a href="#" class="center fa fa-remove icon-white"></a>
                        </div>`;
                            return html;
                        });

                    var items = document.querySelectorAll('.menuItem');
                    for (var i = 0, l = items.length; i < l; i++) {
                        items[i].style.left = (50 - 35 * Math.cos(-0.5 * Math.PI - 2 * (1 / l) * i * Math.PI)).toFixed(4) + '%';
                        items[i].style.top = (50 + 35 * Math.sin(-0.5 * Math.PI - 2 * (1 / l) * i * Math.PI)).toFixed(4) + '%';
                    }

                    window.clearTimeout(menuTimer);
                    menuTimer = setTimeout(function () {
                        document.querySelector('.menu-circle').classList.toggle('open');
                    }, 20);

                    // 关闭菜单
                    circleMenu.select('.center').on('click', function () {
                        closeMenu();
                    });

                    // 删除节点
                    circleMenu.select('#menu_btn_trash').on('click', function () {
                        // scope.removeNodesAndRelations();
                        removeNR(ids, graph);
                        closeMenu();
                    });

                    // 刷新节点间关系
                    circleMenu.select('#menu_btn_refresh').on('click', function () {
                        if (isMulti) {
                            // scope.refreshNodeRelations();
                            refreshNR(ids, graph);
                            closeMenu();
                        }
                    });

                    // 显示节点信息
                    circleMenu.select('#menu_btn_toggleSelection').on('click', function () {
                        if (!isMulti) {
                            // scope.toggleSelection();
                            toggleSelection(ids);
                            closeMenu();
                        }
                    });

                    // 展开子关系节点
                    circleMenu.select('#menu_btn_openNodeRelations').on('click', function () {
                        if (!isMulti) {
                            // scope.open();
                            openNR(ids, graph);
                            closeMenu();
                        }
                    });

                    // 收起子关系节点
                    circleMenu.select('#menu_btn_closeNodeRelations').on('click', function () {
                        if (!isMulti) {
                            // scope.close();
                            closeNR(ids, graph);
                            closeMenu();
                        }
                    });

                    // 获取节点关系
                    circleMenu.select('#menu_btn_findRelations').on('click', function () {
                        if (isMulti) {
                            // scope.find();
                            findNR(ids, graph);
                            closeMenu();
                        }
                    });

                    // 获取深层节点关系
                    circleMenu.select('#menu_btn_findDeepRelations').on('click', function () {
                        if (isMulti) {
                            // scope.findDeep();
                            findDeepNR(ids, graph);
                            closeMenu();
                        }
                    });
                }

            }
        }

        // 时间轴筛选关系
        slideTimeline();
    }


    // 删除节点及关系
    function removeNR(ids, graph) {
        console.log('删除节点及关系', ids);

        graph.nodes = graph.nodes.filter(({ id }) => {
            return !ids.includes(id);
        });
        graph.relations = graph.relations.filter(({ startNode, endNode }) => {
            return !(ids.includes(startNode) || ids.includes(endNode));
        });

        // 更新画图数据
        update(graph, ids);
    }

    // 刷新节点间关系
    function refreshNR(ids, graph) {
        console.log('刷新节点间关系', ids);

    }

    // 显示节点信息
    function toggleSelection(ids) {
        console.log('显示节点信息', ids);

    }

    // 展开子关系节点
    function openNR(ids, graph) {
        toggleMask(true);

        console.log('展开子关系节点', ids);
        const [id] = ids;
        const url = './data/sub/spread.' + id + '.json';
        const addNR = (_graph) => {
            toggleNR(id, graph, true);
            const { relations, nodes } = _graph;
            graph.relations = [...graph.relations, ...relations];
            graph.nodes = [...graph.nodes, ...nodes];
            return graph;
        };

        var _graph = updateCache.get(url);
        if (_graph) {
            // --> 渲染力学图
            requestAnimationFrame(function () {
                update(addNR(_graph), ids);
            });
            return;
        }

        d3.json(url, function (error, _graph) {
            if (error) {
                toggleMask(false);
                return console.error(error);
            }
            if (typeof _graph === 'string') {
                try {
                    _graph = JSON.parse(_graph);
                } catch (error) {
                    toggleMask(false);
                    console.error('无法解析 JOSN 格式！', url);
                    return;
                }
            }
            updateCache.set(url, _graph);
            update(addNR(_graph), ids);
        });

    }

    // 收起子关系节点
    function closeNR(ids, graph) {
        console.log('收起子关系节点', ids);
        const [id] = ids;

        // 全部收起
        if (id === COMPANY_ID) {
            graph.relations = [];
            graph.nodes = graph.nodes.filter(({ id }) => id === COMPANY_ID);
            toggleNR(id, graph, false);
            // 更新画图数据
            update(graph, ids);
            return;
        }

        // 直接关系
        const directRels = graph.relations.filter(({ startNode, endNode }) => startNode === id || endNode === id);

        // 直接节点
        const directNodes = directRels.reduce((set, { startNode, endNode }) => {
            if (startNode !== id) {
                set.add(startNode);
            }
            if (endNode !== id) {
                set.add(endNode);
            }
            return set;
        }, new Set());
        // 关闭节点
        const closeNodes = graph.relations.reduce((set, { startNode, endNode }) => {
            if (startNode !== id && endNode !== id) {
                if (directNodes.has(startNode)) {
                    set.delete(startNode);
                }
                if (directNodes.has(endNode)) {
                    set.delete(endNode);
                }
            }
            return set;
        }, directNodes);

        // 过滤关系
        graph.relations = graph.relations.filter(({ startNode, endNode }) => {
            return !(
                (startNode === id && closeNodes.has(endNode))
                || (endNode === id && closeNodes.has(startNode))
            );
        });

        // 过滤节点
        graph.nodes = graph.nodes.filter(({ id }) => {
            return !closeNodes.has(id);
        });

        toggleNR(id, graph, false);

        // 更新画图数据
        update(graph, ids);
    }

    // 打开/收起节点关系
    const toggleNR = (id, graph, state = true) => {
        const openIndex = graph.nodes.findIndex(({ id: openId }) => openId === id);
        Object.assign(graph.nodes[openIndex], { open: state });
    }

    // 获取节点间关系
    function findNR(ids, graph) {
        console.log('获取节点关系', ids);

    }

    // 获取深层节点关系
    function findDeepNR(ids, graph) {
        console.log('获取深层节点关系', ids);
        const url = './data/sub/between.' + ids + '.json';
        const addNR = (_graph) => {
            const { relations, nodes } = _graph;
            graph.relations = [...graph.relations, ...relations];
            graph.nodes = [...graph.nodes, ...nodes];
            return graph;
        };

        var _graph = updateCache.get(url);
        if (_graph) {
            // --> 渲染力学图
            requestAnimationFrame(function () {
                update(addNR(_graph), ids);
            });
            return;
        }

        d3.json(url, function (error, _graph) {
            if (error) {
                toggleMask(false);
                return console.error(error);
            }
            if (typeof _graph === 'string') {
                try {
                    _graph = JSON.parse(_graph);
                } catch (error) {
                    toggleMask(false);
                    console.error('无法解析 JOSN 格式！', url);
                    return;
                }
            }
            updateCache.set(url, _graph);
            update(addNR(_graph), ids);
        });

    }

    // 时间轴筛选关系（修改样式）
    var newRFlag, oldRFlag;
    function slideTimeline() {
        newRFlag = links.data().map(function (d) {
            return d.lines.filter(function (d) {
                return d.disuse;
            }).join();
        }).sort().join();

        nodes.each(function (d) {
            d3.select(this).classed('disuse', d.disuse);
            d3.select(this).classed('selected', d.selected);
        });

        links.each(function (d) {
            d3.select(this).selectAll('line').each(function (d) {
                d3.select(this).classed('filter', d.disuse);
                d3.select(this).classed('selected', d.selected);
            });
        });

        if (oldRFlag != newRFlag) {
            renderFlowBall(links);
        }

        oldRFlag = newRFlag;
    }

    function tick() {
        ticking = true;
        links.each(function (link) {
            var lineG = d3.select(this);

            var {
                source: {
                    id: sid,
                    x: sx,
                    y: sy,
                    r: sr
                },
                target: {
                    id: tid,
                    x: tx,
                    y: ty,
                    r: tr
                },
                lines,
            } = link;

            var count = lines.length; // 连线条数

            //关系连线
            lineG.selectAll('line').each(function (d, i) {
                const { startNode, endNode, type } = d;
                const isReverse = (+startNode === +tid && +endNode === +sid);
                if (isReverse) {
                    var path = getLinePath(tx, ty, sx, sy, tr, sr, i, count, isReverse);
                }
                else {
                    var path = getLinePath(sx, sy, tx, ty, sr, tr, i, count, isReverse);
                }

                // 设置连线路径 x1, y1, x2, y2
                d3.select(this).attr(path);
                // 挂载连线路径 x1, y1, x2, y2 到 line 上
                Object.assign(d, path);
            });

            // 关系文字
            lineG.selectAll('text').attr('transform', function (d) {
                var { x1, y1, x2, y2 } = d;
                var textX = x1 + (x2 - x1) / 2;
                var textY = y1 + (y2 - y1) / 2;
                var textAngle = getAngle(x1, y1, x2, y2);
                var textRotate = (textAngle > 90 || textAngle < -90) ? (180 + textAngle) : textAngle;
                return ['translate(' + [textX, textY] + ')', 'rotate(' + textRotate + ')'].join(' ');
            });
        });

        nodes
            .attr('transform', function (d) {
                return 'translate(' + [d.x, d.y] + ')'
            });
    }

    function getAngle(sx, sy, tx, ty) {
        const a = ty - sy; // 对边长度
        const b = tx - sx; // 临边长度
        const c = Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2)); // 斜边长度
        // 求出弧度
        const radian = Math.acos(b / c);
        // 用弧度算出角度   
        let angle = 180 / (Math.PI / radian);
        if (a < 0) {
            angle *= -1;
        } else if ((a == 0) && (b < 0)) {
            angle = 180;
        }
        return angle;
    }

    function dragstart(d) {
        clearTimeout(dragTimer);
        isDraging = true;
        d3.select(this).classed('fixed', d.fixed = true);
        d3.event.sourceEvent.stopPropagation();
    }

    function draging(d) {
        isDraging = true;
        d3.select(this).classed('fixed', d.fixed = true);
        d3.event.sourceEvent.stopPropagation();
    }

    function dragend(d) {
        isDraging = false;
        dragTimer = setTimeout(function () {
            force.stop();
        }, 1500);
    }

    function zoomFn() {
        var off = d3.select('#offZoom').property('checked');
        if (off) {
            return;
        }
        var {
            translate,
            scale
        } = d3.event;
        container.attr('transform', 'translate(' + translate + ')scale(' + scale + ')');
    }

    /**
     * 获取关系连线的路径
     * @param {number} sx 
     * @param {number} sy 
     * @param {number} tx 
     * @param {number} ty 
     * @param {number} r 节点半径
     * @param {number} index 连线索引
     * @param {number} count 连线条数
     * @param {boolean} isReverse 是否反向关系
     */
    function getLinePath(sx, sy, tx, ty, sr, tr, i, count = 1, isReverse = false) {

        var getXY = r => {
            var b1 = tx - sx; // 邻边
            var b2 = ty - sy; // 对边
            var b3 = Math.sqrt(b1 * b1 + b2 * b2); // 斜边
            var angle = 180 * Math.asin(b1 / b3) / Math.PI;
            var isY = b2 < 0;
            var a = Math.cos(angle * Math.PI / 180) * r;
            var b = Math.sin(angle * Math.PI / 180) * r;
            var sourceX = sx + b;
            var sourceY = isY ? sy - a : sy + a;
            var targetX = tx - b;
            var targetY = isY ? ty + a : ty - a;
            var padding = r < 40 ? (isReverse ? r : -8) : 0; // 控制连线距离圆边的边距
            var maxCount = 5; // 最大连线数
            var minStart = count === 1 ? 0 : -r / 2 + padding;
            var start = minStart * (count / maxCount); // 连线线开始位置
            start = count === 2 ? start += 5 : start;
            var space = count === 1 ? 0 : Math.abs(minStart * 2 / (maxCount - 1)); // 连线间隔
            var position = start + space * i; // 生成 20 0 -20 的 position 模式

            if (position > r) {
                return {
                    x1: sx,
                    y1: sy,
                    x2: tx,
                    y2: ty
                };
            }

            // s 两次三角函数计算的值
            var s = r - Math.sin(180 * Math.acos(position / r) / Math.PI * Math.PI / 180) * r;

            // _a 和 _b 是拿到 ang 角度的基准值
            var _a = Math.cos(angle * Math.PI / 180);
            var _b = Math.sin(angle * Math.PI / 180);

            // a 和 b 是得到垂直于原点平行 position 长度的偏移量。 两个偏移量按照下面的逻辑相加就是平行线的位置
            a = _a * position;
            b = _b * position;
            var rx = _b * s;
            var ry = _a * s;

            var x1 = (isY ? sourceX + a : sourceX - a) - rx;
            var y1 = (isY ? sourceY + ry : sourceY - ry) + b;

            var x2 = (isY ? targetX + a : targetX - a) + rx;
            var y2 = (isY ? targetY - ry : targetY + ry) + b;

            return { x1, y1, x2, y2 };
        }

        var { x1, y1 } = getXY(sr);
        var { x2, y2 } = getXY(tr);

        return { x1, y1, x2, y2 };
    }

    // 获取节点文字段落
    function getParagraphs(text) {
        const len = text.length;
        if (len <= 4) {
            return [text];
        }
        const topText = text.substring(0, 4);
        const midText = text.substring(4, 9);
        let botText = text.substring(9, len);
        botText = len > 13 ? text.substring(9, 12) + '...' : botText;
        return [topText, midText, botText];
    }

    // 清除数据流动画
    function clearFlowAnim() {
        flowAnim.stopAll();
        d3.selectAll('.flow').remove();
        links.each(function (d) {
            d.lines.forEach(function (d) {
                delete d.flow;
            });
        });
    }

    // 渲染数据流动画
    function renderFlowBall(links) {
        clearFlowAnim();
        var activeLinks = links.filter(d => !d.disuse);

        activeLinks.each(function () {
            var m = 0;
            var activeLink = d3.select(this);
            var activeLines = activeLink.selectAll('line');
            var flowLines = activeLines.filter(d => ['TELPHONE', 'BANK'].includes(d.type));

            activeLines.each(function (d, k) {
                if (['TELPHONE', 'BANK'].includes(d.type)) {
                    d.flow = activeLink.append('circle')
                        .attr('class', 'flow')
                        .attr('r', flowScale(d.amout || 1))
                        .style('fill', RELATION_COLOURS[d.type]);
                }
            });

            flowAnim.start(function () {
                flowLines.each(function (d) {
                    var flowLine = d3.select(this);
                    var x1 = parseInt(flowLine.attr('x1'));
                    var y1 = parseInt(flowLine.attr('y1'));
                    var x2 = parseInt(flowLine.attr('x2'));
                    var y2 = parseInt(flowLine.attr('y2'));
                    var x = x1 + ((m % 200) / 199) * (x2 - x1);
                    var y = y1 + ((m % 200) / 199) * (y2 - y1);
                    if (x && y) {
                        d.flow.attr('cx', x).attr('cy', y);
                    }
                });
                m++;
            }, 90);
        });

    }

    function toggleMask(isShow = true) {
        let loadingMask = document.querySelector('#timeline-mask');
        if (isShow) {
            if (!loadingMask) {
                const canvas = document.querySelector('#graph-main');
                loadingMask = document.createElement('div');
                loadingMask.setAttribute('id', 'timeline-mask');
                canvas.appendChild(loadingMask);
            }
            const mask = `` +
                `<div class="loader">
                    <div class="loading-anim">
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                        <i></i>
                    </div>
                </div>`;
            loadingMask.innerHTML = mask;
            loadingMask.style.cssText = 'display: flex';
        } else {
            if (loadingMask) {
                loadingMask.innerHTML = '';
                loadingMask.style.cssText = 'display: none';
            }
        }
    }

    /**
     * 组合排列
     *  [1, 2, 3] => [[1, 2], [1, 3], [2, 3]]
     * @param {Array} arr 
     * @param {number} size 
     */
    function permutation(arr, size = 2) {
        const ret = [];

        (function fn(target, source, size) {
            if (size === 0) { // 退出递归
                ret[ret.length] = target;
                return ret;
            }
            for (let i = 0; i <= (source.length - size); i++) {
                fn([...target, source[i]], source.slice(i + 1), size - 1);
            }
        })([], arr, size);

        return ret;
    }

    // // 切换拖动/选取
    // d3.select('#offZoom').on('change', function () {
    //     var off = this.checked;
    //     d3.select('.zoom-overlay').classed('hidden', off);
    //     d3.select('.brush-rect').classed('hidden', !off);
    // });
}

// 清理画布
function cleanUpCanvas() {
    d3.select('#graph-main').html('');
    clearChange();
}