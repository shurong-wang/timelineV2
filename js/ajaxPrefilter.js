; (function ($) {
    const pendingRequests = {};
    $.ajaxPrefilter(function (options, originalOptions, jqXHR) {
        const key = options.url;
        if (pendingRequests[key]) {
            pendingRequests[key].abort();
        }
        pendingRequests[key] = jqXHR;
        var complete = options.complete;
        options.complete = function (jqXHR, textStatus) {
            pendingRequests[key] = null;
            if ($.isFunction(complete)) {
                complete.apply(this, arguments);
            }
        };
    });
    $.ajaxSetup({
        timeout: 6000,
        crossDomain: true
    });
})(jQuery);