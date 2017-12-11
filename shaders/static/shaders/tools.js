Tools = {}

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
        includes.push({
            pos: match.index,
            len: match[0].length,
            line: Tools.posToLineNumber(text, match.index),
            name: match[1]
        });
    }
    return includes;
}

