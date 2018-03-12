var TimelineBar = function (element) {
    var that = this;
    this.margin = {
        top: 10,
        right: 10,
        bottom: 20,
        left: 30
    };
    this.setting = {
        intervalMinWidth: 8, // px
        tip: undefined,
        textTruncateThreshold: 30,
        enableLiveTimer: false,
        timerTickInterval: 1000,
        fn: function () {}
    };
    this.element = element;

    element.classList.add('timeline-bar');

    return this;
};

// 绘制时间轴工具条
TimelineBar.prototype.renderTimeBar = function (data, opts, callback) {
    this.setting = this.extendSetting(opts);
    if (!data) data = this.data;
    if (!data) return;
    this.data = data;
    var that = this;

    this.allElements = data.reduce(function (agg, e) {
        return agg.concat(e.data);
    }, []);

    this.minDt = d3.min(this.allElements, this.getPointMinDt) || this.minDt;
    this.maxDt = d3.max(this.allElements, this.getPointMaxDt) || this.maxDt;

    this.elementWidth = this.setting.width || this.element.clientWidth
        || this.element.parentElement.parentElement.clientWidth;
    this.elementHeight = this.setting.height || this.element.clientHeight
        || this.element.parentElement.parentElement.clientHeight;

    this.width = this.elementWidth - this.margin.left - this.margin.right;
    this.height = this.elementHeight - this.margin.top - this.margin.bottom;

    this.groupWidth = 0;

    if (!this.minDt) {
        return;
    }

    var startDate = new Date(this.minDt.getTime() - 25920000000);
    var endDate = new Date(this.maxDt.getTime() + 25920000000);
    var xDomain = this.x && !callback ? this.x.domain() : [startDate, endDate];
    var xRange = [this.groupWidth, this.width];

    // 创建一个时间比例尺
    this.x = d3.time.scale()
        .domain(xDomain)
        .range(xRange);

    // 时间解析器
    var f = d3.time.format.multi([
        [".%L毫秒", function (d) {
            return d.getMilliseconds();
        }],
        [":%S秒", function (d) {
            return d.getSeconds();
        }],
        ["%H点:%M分", function (d) {
            return d.getMinutes();
        }],
        ["%H点", function (d) {
            return d.getHours();
        }],
        ["%m月%d日", function (d) {
            return d.getDay() && d.getDate() != 1;
        }],
        ["%m月%d日", function (d) {
            return d.getDate() != 1;
        }],
        ["%Y-%m", function (d) {
            return d.getMonth();
        }],
        ["%Y-%m", function () {
            return true;
        }]
    ]);

    // 新建坐标轴
    this.xAxis = d3.svg.axis()
        .scale(this.x)
        .orient('bottom')
        .tickSize(-this.height)
        .tickFormat(function (d) {
            return f(d);
        });

    // 缩放/平移动作
    this.zoom = d3.behavior.zoom()
        .x(this.x)
        .scaleExtent(this.setting.zoom || [1.5, 1.5])
        .on('zoom', function () {
            that.zoomed()
        })
        .scale(this.setting.startZoom || 1.5);

    var extent = this.brush && this.brush.extent && this.brush.extent();

    // 拖动时间轴工具条-更新时间范围-更新关系图
    this.brush = d3.svg.brush()
        .x(this.x)
        .on('brush', function () {
            // 更新关系图
            if (that.setting.fn.onBrush) {
                var extent = that.brush.extent();
                var startTime = extent[0].getTime();
                var endTime = extent[1].getTime();
                that.setting.fn.onBrush(startTime, endTime);
            }
        });

    if (extent) {
        this.brush.extent(extent);
    }

    this._svg = this._svg || d3.select(this.element).append('svg');
    this._svg
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom);
    this.svg = this.svg || this._svg.append('g');
    this.svg.attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

    this.chart_brush = this.chart_brush || this.svg.append('g')
        .attr('class', 'chart-brush');
    var brush = this.chart_brush.call(this.brush);

    brush.selectAll("rect")
        .attr('height', this.height);

    brush.selectAll(".resize").append('path')
        .attr("class", "handle--custom")
        .attr("fill", "rgb(8, 147, 228)")
        .attr("fill-opacity", 0.8)
        .attr("stroke", "rgb(7, 117, 180)")
        .attr("stroke-width", 1.5)
        .attr("cursor", "ew-resize")
        .attr("d", d3.svg.arc()
            .innerRadius(0)
            .outerRadius(this.height / 2)
            .startAngle(0)
            .endAngle(function (d, i) {
                return i ? -Math.PI : Math.PI;
            }))
        .attr("transform", "translate(" + [0, this.height / 2] + ")");

    this.chart_bounds = this.chart_bounds || this.svg.append('rect');
    this.chart_bounds.attr('class', 'chart-bounds')
        .attr('x', this.groupWidth)
        .attr('y', 0)
        .attr('height', this.height)
        .attr('width', this.width - this.groupWidth)
        .call(this.zoom);

    this.xDom = this.xDom || this.svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + this.height + ')');
    this.xDom.call(this.xAxis);

    if (this.setting.enableLiveTimer) {
        this.now = this.now || this.svg.append('line')
            .attr('clip-path', 'url(#chart-content)')
            .attr('class', 'vertical-marker now')
            .attr("y1", 0)
            .attr("y2", this.height);
    } else {
        clearInterval(this.enableLiveTimerTime);
        if (this.now && this.now.remove) this.now.remove();
        this.now = false;
    }

    this.groupHeight = this.height / data.length;
    this.groupSection = this.groupSection || this.svg.selectAll('.group-section')
        .data(data)
        .enter()
        .append('line');

    this.groupSection.attr('class', 'group-section')
        .attr('x1', 0)
        .attr('x2', this.width)
        .attr('y1', function (d, i) {
            return that.groupHeight * (i + 1);
        }).attr('y2', function (d, i) {
            return that.groupHeight * (i + 1);
        });

    // var groupLabels = svg.selectAll('.group-label')
    //     .data(data)
    //     .enter()
    //     .append('text')
    //     .attr('class', 'group-label')
    //     .attr('x', 0)
    //     .attr('y', function (d, i) {
    //         return that.groupHeight * i + that.groupHeight / 2 + 5.5;
    //     })
    //     .attr('dx', '0.5em').text(function (d) {
    //         return d.label;
    //     });

    this.topLine = this.topLine || this.svg.append('line');
    this.leftLine = this.leftLine || this.svg.append('line');
    this.rightLine = this.rightLine || this.svg.append('line')

    this.topLine
        .attr('x1', 0)
        .attr('x2', this.width)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', 'black');
    this.leftLine
        .attr('x1', this.groupWidth)
        .attr('x2', this.groupWidth)
        .attr('y1', 0)
        .attr('y2', this.height)
        .attr('stroke', 'black');
    this.rightLine
        .attr('x1', this.width)
        .attr('x2', this.width)
        .attr('y1', 0)
        .attr('y2', this.height)
        .attr('stroke', 'black');

    this._svg.selectAll('.item').remove();

    this._groupIntervalItems = this.svg.selectAll('.group-interval-item')
        .data(data)
        .enter()
        .append('g')
        .attr('clip-path', 'url(#chart-content)')
        .attr('class', 'item')
        .attr('transform', function (d, i) {
            return 'translate(0, ' + that.groupHeight * i + ')';
        })
        .selectAll('.dot')
        .data(function (d) {
            return d.data.filter(function (_) {
                return _.type === 'interval';
            });
        });

    this.groupIntervalItems = this._groupIntervalItems.enter();

    var intervalBarHeight = 0.8 * this.groupHeight;
    var intervalBarMargin = (this.groupHeight - intervalBarHeight) / 2;
    var intervals = this.groupIntervalItems.append('rect')
        .attr('class', this.withCustom('interval'))
        .attr('dx', 5)
        .attr('dy', 5)
        .attr('width', function (d) {
            return Math.max(that.setting.intervalMinWidth, that.x(d.to) - that.x(d.from));
        })
        .attr('height', intervalBarHeight)
        .attr('y', intervalBarMargin)
        .attr('x', function (d) {
            return that.x(d.from);
        });

    var intervalTexts = this.groupIntervalItems.append('text')
        .text(function (d) {
            return d.label;
        })
        .attr('fill', 'white')
        .attr('class', this.withCustom('interval-text'))
        .attr('y', this.groupHeight / 2 + 5)
        .attr('x', function (d) {
            return that.x(d.from);
        });

    this.group = this.svg.selectAll('.group-dot-item')
        .data(data)
        .enter()
        .append('g')
        .attr('clip-path', 'url(#chart-content)')
        .attr('class', 'item')
        .attr('transform', function (d, i) {
            return 'translate(0, ' + that.groupHeight * i + ')';
        });
    this.yScale = this.yScale || d3.scale.linear();
    this.yScale
        .domain([
            d3.max(data[0].data, function (d) { return d.value; }),
            0
        ])
        .range([0, this.groupHeight]);

    this.yAxis = this.yAxis || d3.svg.axis();
    this.yAxis.scale(this.yScale).orient("left").ticks(2)
    this.yax = this.yax || this.svg.append("g");
    this.yax.attr("class", "axis").call(this.yAxis);


    this._groupDotItems = this.group.selectAll('.dot')
        .data(function (d) {
            return d.data.filter(function (_) {
                return _.type === 'point';
            });
        });
    this.groupDotItems = this._groupDotItems.enter();
    var dots = this.groupDotItems.append('circle')
        .attr('class', this.withCustom('dot'))
        .attr('cx', function (d) {
            return that.x(d.at);
        })
        .attr('cy', this.groupHeight / 2)
        .attr('r', 5);

    this._groupBarItems = this.group.selectAll('.bar')
        .data(function (d) {
            return d.data.filter(function (_) {
                return _.type === 'bar';
            })
        });

    this.groupDotItems = this._groupBarItems.enter();
    var dots = this.groupDotItems.append('rect')
        .attr('class', this.withCustom('bar'))
        .attr('x', function (d) {
            return that.x(d.at) - 2.5;
        })
        .attr('y', function (d) {
            return that.yScale(d.value) + 1
        })
        .attr('width', 5)
        .attr('height', function (d) {
            return that.groupHeight - that.yScale(d.value) - 1
        })
        .style('fill', 'rgb(141, 149, 250)');


    this.zoomed();

    if (this.setting.enableLiveTimer) {
        this.enableLiveTimerTime = setInterval(function () {
            that.updateNowMarker()
        }, this.setting.timerTickInterval);
    }

}

TimelineBar.prototype.withCustom = function (defaultClass) {
    return function (d) {
        return d.customClass ? [d.customClass, defaultClass].join(' ') : defaultClass;
    };
}

TimelineBar.prototype.updateNowMarker = function () {
    var nowX = this.x(new Date());

    this.now.attr('x1', nowX).attr('x2', nowX);
}

TimelineBar.prototype.zoomed = function () {
    var that = this;
    if (this.onVizChangeFn && d3.event) {
        this.onVizChangeFn.call(this, {
            scale: d3.event.scale,
            translate: d3.event.translate,
            domain: this.x.domain()
        });
    }

    if (this.setting.enableLiveTimer) {
        this.updateNowMarker();
    }

    // var max = new Date().getTime() + 1000*60*60*24*365;
    // var start = this.x.domain()[0].getTime();
    // var end = this.x.domain()[1].getTime();
    // var qj = end - start;
    // if(end > max) {
    //     this.x.domain([new Date(max - qj), new Date(max)]);
    //     this.zoom.x(this.x)
    //     console.log(this.zoom.scaleExtent(), d3.event.scale)
    //     this.chart_bounds.call(this.zoom)
    // }

    this.svg.select('.x.axis').call(this.xAxis);

    this.svg.selectAll('circle.dot')
        .attr('cx', function (d) {
            return that.x(d.at);
        });
    this.svg.selectAll('rect.bar')
        .attr('x', function (d) {
            return that.x(d.at) - 2.5;
        })
    this.svg.selectAll('rect.interval')
        .attr('x', function (d) {
            return that.x(d.from);
        }).attr('width', function (d) {
            return Math.max(that.setting.intervalMinWidth, that.x(d.to) - that.x(d.from));
        });

    this.svg.selectAll('.interval-text')
        .attr('x', function (d) {
            var positionData = that.getTextPositionData(this, d);
            if (positionData.upToPosition - groupWidth - 10 < positionData.textWidth) {
                return positionData.upToPosition;
            } else if (positionData.xPosition < groupWidth && positionData.upToPosition > groupWidth) {
                return groupWidth;
            }
            return positionData.xPosition;
        })
        .attr('text-anchor', function (d) {
            var positionData = that.getTextPositionData(this, d);
            if (positionData.upToPosition - groupWidth - 10 < positionData.textWidth) {
                return 'end';
            }
            return 'start';
        })
        .attr('dx', function (d) {
            var positionData = that.getTextPositionData(this, d);
            if (positionData.upToPosition - groupWidth - 10 < positionData.textWidth) {
                return '-0.5em';
            }
            return '0.5em';
        })
        .text(function (d) {
            var positionData = that.getTextPositionData(this, d);
            var percent = (positionData.width - that.setting.textTruncateThreshold) / positionData.textWidth;
            if (percent < 1) {
                if (positionData.width > that.setting.textTruncateThreshold) {
                    return d.label.substr(0, Math.floor(d.label.length * percent)) + '...';
                } else {
                    return '';
                }
            }

            return d.label;
        });

    this.chart_brush.call(this.brush.extent(this.brush.extent()));
}

TimelineBar.prototype.extendSetting = function (ext) {
    var ol = [];
    for (var i in ext) { 
        ol.push(i);
    }
    for (var i in ol) {
        this.setting[ol[i]] = ext[ol[i]];
    }
    return this.setting;
}

TimelineBar.prototype.getTextPositionData = function (t, d) {
    t.textSizeInPx = t.textSizeInPx || t.getComputedTextLength();
    var from = this.x(d.from);
    var to = this.x(d.to);
    return {
        xPosition: from,
        upToPosition: to,
        width: to - from,
        textWidth: t.textSizeInPx
    };
}

TimelineBar.prototype.getPointMinDt = function (p) {
    if (p.type == 'point') {
        return p.at
    } else if (p.type == 'bar') {
        return p.at
    } else {
        return p.form
    }
}
TimelineBar.prototype.getPointMaxDt = function (p) {
    if (p.type == 'point') {
        return p.at
    } else if (p.type == 'bar') {
        return p.at
    } else {
        return p.to
    }
}
TimelineBar.prototype.onVizChange = function (fn) {
    this.onVizChangeFn = fn;
    return this;
}

TimelineBar.prototype.showSelect = function () {
    this.chart_bounds.style('display', 'none');
}
TimelineBar.prototype.hideSelect = function () {
    this.chart_bounds.style('display', 'block');
}
TimelineBar.prototype.clearBrush = function () {
    if (this.chart_brush) {
        this.chart_brush.call(this.brush.clear());
        this.broadcastBrush();
    }
}
TimelineBar.prototype.setBrush = function (start, end) {
    if (this.chart_brush) {
        this.chart_brush.call(this.brush.extent(arguments));
        this.broadcastBrush();
    }
}
TimelineBar.prototype.broadcastBrush = function () {
    this.brush.event(this.chart_brush);
}