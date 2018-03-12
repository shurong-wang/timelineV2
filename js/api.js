const HOST = 'http://47.93.45.8:8080/';

//const HOST = 'http://127.0.0.1:8080/';
//const HOST = 'http://192.168.1.27:8080/';

function getQueryVariable(key) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        if(pair[0] == key){return pair[1];}
    }
    return false;
}

function api(req, params) {
	    const APIS = {
	        // 此处添加 api 映射列表
	        companyDetail: 'jstx/findCompanyDetail.do',
	        relations: 'jstx/getRelationNode.do',
	        findCompany: 'jstx/findCompany.do',
	        investTree: 'jstx/getOutBoundInvest.do',
	        companyInfo: 'jstx/findCompanyDetailInfo.do',
			Business: 'jstx/getAllBusiness.do',
			Tax:'jstx/finaCompanyOwnTax.do',
			CompanyEmployment:'jstx/getCompanyEmployment.do',
			getDivestiture:'jstx/getDivestiture.do',
			BoundForArea:'jstx/getOutBoundForArea.do',
			searchCompany: 'jstx/searchCompany.do',
			findRelations: 'jstx/getRelationFind.do',
			shortPath: 'jstx/getShortPath.do',
			getTimeLine: 'jstx/getTimeLine.do'
	    };
	    const API = APIS[req];
	    if (!API) {
	        throw '调用了非法的 api: ' + req;
	        return;
	    }

	    const QUERY = (function (paramss) {
	        const isJSON = o => o && ({}).toString.call(o).slice(8, -1) === 'Object';
			return isJSON(params) ? Object.entries(params).map(([key, value]) => key + '=' + value).join('&') : '';
	    })(params);

	    const API_URL =  HOST + API + (QUERY ? '?' + QUERY : '');
	    // console.warn(API_URL);
	    
	    return API_URL;
	}