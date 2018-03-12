$(function () {
    /**
     * 全屏切换
     */
    if (!screenfull.enabled) {
        console.error('您的浏览器不支持全屏操作');
        return false;
    }

    $('#fullScreen').on('click', function () {
        screenfull.request(document.querySelector('#main'));
    });

    $('#exitScreen').on('click', function () {
        screenfull.exit();
    });

    var oriWidth = $('#relation').width();
    var oriHeight = $('#relation').height();
    $('#timeline').css("width", oriWidth);

    // 全屏切换
    screenfull.on('change', function () {
        var screenElem = screenfull.element;
        if (screenfull.isFullscreen) {
            $('#fullScreen').addClass('hidden');
            $('#exitScreen').removeClass('hidden');
            var width = $('#relation').width();
            var height = $('#relation').height();
            $('#relation').find('svg.svgCanvas, rect.zoom-overlay, rect.background')
                .attr("width", width)
                .attr("height", height);
            $('#timeline').css("width", width);
        }
        else {
            $('#fullScreen').removeClass('hidden');
            $('#exitScreen').addClass('hidden');
            $('#relation').find('svg.svgCanvas, rect.zoom-overlay, rect.background')
                .attr("width", oriWidth)
                .attr("height", oriHeight);
            $('#timeline').css("width", oriWidth);
        }
    });

    /* -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */

    /**
     * 导入数据
     */
    var $importItem = $('#import dl');
    $importItem.one('click', 'button', function () {
        $(this).addClass('disabled');
        var id = $(this).parents('dl').attr('id');
        var $describe = $('#' + id).find('small');
        var $progress = $('#' + id).find('.progress');
        $describe.addClass('hidden');
        $progress.removeClass('hidden');

        var start = 0;
        var rate = .61;
        var end = 100;
        var progress = start;
        var text = '0%';

        var step = function () {
            progress += rate;
            progress = Math.min(Math.round(progress * 10) / 10, 100.0);
            text = progress === 100.0 ? 'Complete' : progress + '%';
            $progress.find('.progress-bar').width(progress + '%');
            $progress.find('.progress-bar span').text(text);
            if (progress < 100) {
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    });


    /* -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */

    /**
     * 企业搜索
     */
    var SEARCH_API = 'asset/search.json';

    // 提交
    $('#btn-search').on('click', function (e) {
        var query = $.trim($('#input-search').val());
        if (query < 1) {
            return;
        }
        $.get(SEARCH_API, { companyName: query })
            .done(function (data) {
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                // data -> view
                process(data);
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                if (errorThrown != 'abort') {
                    console.warn(errorThrown);
                }
                if (errorThrown == 'timeout') {
                    console.warn('请求超时，请稍后重试！');
                }
            })
            .always(function (jqXHR, textStatus, errorThrown) {
                // ...
            });
    });

    // 输入
    $('#input-search').on('input', function (e) {
        // 中文输入中，不做操作
        if ($(this).prop('inputting')) {
            return;
        }
        var query = $.trim($('#input-search').val());
        console.log(query);
        if (query < 1) {
            $('.search-list dd').remove();
        }
    }).on('compositionstart', function () {
        $(this).prop('inputting', true);
    }).on('compositionend', function () {
        $(this).prop('inputting', false);
        // 选词结束时 input 先于 compositionend 触发，此时 inputting 未更新为 true
        // 因此，需要再手动触发一次 input 事件
        $(this).trigger('input');
    }).on('keyup', function (e) {
        var curKey = e.which;
        if (curKey == 13) {
            $('#btn-search').trigger('click');
        }
    });

    // 填充
    function process(data) {
        $('.search-list dd').remove();
        if (!data) {
            return;
        }
        var mapCompany = {};
        var html = data.map(d => {
            mapCompany[d.id] = d;
            var {
                id, // 企业 ID
                name, // 公司名称
                regStatus = '', // 状态标识
                legalPersonName = '', // 法人
                companyOrgType = '', // 企业类型
                regCapital = '', // 注册资本
                estiblishTime = '', // 注册时间
                regLocation = '', // 注册地址
                base = ''// 城市
            } = d;
            return `` +
                `<dd id="company-${id}">
                    <ul>
                        <li>
                            <a class="company-name" data-id="${id}" href="javascript:void(0);">${name}</a>
                            <a class="company-add" role="button" data-id="${id}" href="javascript:void(0);">
                                <span class="glyphicon glyphicon-plus" aria-hidden="true"></span>
                            </a>
                            <span class="pull-right">${base ? '[' + base + ']' : ''}</span>
                        </li>
                        <li>注册资本：${regCapital || '未知'}</li>
                        <li>法人：${legalPersonName || '未知'}</li>
                        <li>注册时间：${estiblishTime || '0000-00-00'}</li>
                    </ul>
                </dd>`;
        });
        $('.search-list').append(html.join(''));
        $('.search-list dd').find('.company-name, .company-add').on('click', function () {
            var id = $(this).data('id');
            var company = mapCompany[id];
            console.log(company);
            // todo ...
        });
    }

    /* -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- */

    /**
     * 渲染图形
    */
    // 获取数据 && 绘制时间轴
    function drawTimeLine() {
        cleanUpCanvas();
        initCanvas(100);
    }

    drawTimeLine();
});