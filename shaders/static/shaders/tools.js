Tools = {}


Tools.ajax = function(url, data) {
    var done_func = null;
    var fail_func = null;

    $.ajax({ url: url, data: data})
    .done(function(data) {
        if (data.error) {
            if (fail_func)
                fail_func(data.error);
        } else if (done_func) {
            done_func(data);
        }
    })
    .fail(function(e) {
        if (fail_func)
            fail_func("server error");
    });

    promise = {}
    promise["done"] = function(f) { done_func = f; return promise; };
    promise["fail"] = function(f) { fail_func = f; return promise; };
    return promise;
}


Tools.post = function(url, data) {
    return $.ajax({
        method: "POST",
        url: url,
        data: JSON.stringify(data),
        headers: {
            "X-CSRFToken": $("[name=csrfmiddlewaretoken]").val()
        },
        contentType: 'application/json; charset=utf-8',
        dataType: 'json'
    });
}

Tools.countLines = function(text) {
    return text.match(/\n/g).length;
};

Tools.posToLineNumber = function(text, pos) {
    var m = text.slice(0, pos).match(/\n/g);
    return m ? m.length : 0;
};

/* Returns list of dicts with (pos, line, name) */
Tools.getIncludes = function(text) {
    var re = /^ *# *include *"(.+)" *\n/mg;
    var match;
    var includes = [];
    while ((match = re.exec(text)) != null) {
        if (match[1].trim().length) {
            var name = match[1].trim();
            var shader = null;
            if (name.includes("/")) {
                var pos = name.search("/");
                shader = name.substr(0, pos);
                name = name.substr(pos+1);
            }
            includes.push({
                pos: match.index,
                len: match[0].length,
                line: Tools.posToLineNumber(text, match.index),
                name: name,
                shader: shader,
            });
        }
    }
    return includes;
}

