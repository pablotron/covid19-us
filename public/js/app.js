window.addEventListener('DOMContentLoaded', function() {
  "use strict";

  var DATA = null,
      DATA_URL = 'data.json?' + (function () {
        return (new Date()).toISOString().replace(/(T..).+$/, '$1');
      })();

  // cache elements
  var E = ['map', 'data'].reduce(function(r, id) {
    r[id] = document.getElementById(id);
    return r;
  }, {});

  // bind dom event handlers
  function on(el, evs) {
    for (var ev in evs) {
      el.addEventListener(ev, evs[ev], false);
    }
  }

  var States = (function() {
    var FLAGS = {};

    // internal event listeners
    var ehs = {};

    function fire(ev, args) {
      if (ehs[ev]) {
        ehs[ev].forEach(function(fn) {
          fn.apply(null, args || []);
        });
      }
    }

    return {
      on: function(ev, fn) {
        if (ehs[ev]) {
          ehs[ev].push(fn);
        } else {
          ehs[ev] = [fn];
        }
      },

      get_flags: function(id) {
        return FLAGS[id] || [];
      },

      add_flag: function(id, flag) {
        var flags = FLAGS[id];

        FLAGS[id] = ((flags && flags.length > 0) ? flags.filter(function(v) {
          return (v != flag);
        }) : []).concat([flag]);

        fire('change', [id]);
      },

      rm_flag: function(id, flag) {
        var flags = FLAGS[id];

        FLAGS[id] = (flags && flags.length > 0) ? flags.filter(function(v) {
          return (v != flag);
        }) : [flag];

        fire('change', [id]);
      },

      toggle_flag: function(id, flag) {
        var flags = FLAGS[id],
            has = (flags && (flags.length > 0) && (flags.indexOf(flag) !== -1));

        FLAGS[id] = has ? flags.filter(function(v) {
          return (v != flag);
        }) : (flags || []).concat([flag]);

        fire('change', [id]);
      },
    };
  })();

  var View = {
    map: {
      update: (function() {
        var FLAGS = ['active', 'hover'];

        return function(id) {
          if (!E.svg || !id.match(/^[A-Z][A-Z]$/)) {
            return;
          }

          var el = E.svg.getElementById(id);
          if (!el) {
            return;
          }

          var cl = el.classList;
          cl.remove.apply(cl, FLAGS);
          cl.add.apply(cl, States.get_flags(id));
        };
      })(),
    },

    html: {
      make_table: (function() {
        var COLS = [{
          src: 'date',
          dst: 'Date',
          css: 'date',
        }, {
          src: 'confirmed',
          dst: 'Confirmed',
          css: 'num',
        }, {
          src: 'deaths',
          dst: 'Deaths',
          css: 'num',
        }, {
          src: 'recovered',
          dst: 'Recovered',
          css: 'num',
        }];

        return function(id) {
          if (!DATA || !DATA.data[id]) {
            return '';
          }

          return '<table><thead><tr>' + COLS.map(function(col) {
            return '<th>' + col.dst + '</th>';
          }).join('') + '</thead><tbody>' + DATA.data[id].map(function(row) {
            return '<tr>' + COLS.map(function(col) {
              return '<td class="' + col.css + '">' + row[col.src] + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table>';
        };
      })(),
    },
  };

  // bind to change event
  States.on('change', function(id) {
    var has_flags = States.get_flags(id).length > 0;
    E.data.innerHTML = has_flags ? View.html.make_table(id) : '';
    View.map.update(id);
  });

  // dom event handlers
  var EHS = {
    // map event handlers
    map: {
      mouseover: function(ev) {
        States.add_flag(ev.target.id, 'hover');
      },

      mouseout: function(ev) {
        States.rm_flag(ev.target.id, 'hover');
      },

      click: function(ev) {
        States.toggle_flag(ev.target.id, 'active');
      },
    },
  };

  // wait for svg to load
  on(E.map, {
    load: function() {
      // cache map svg doc
      E.svg = E.map.contentDocument;

      // bind to map events
      on(E.svg, EHS.map);
    },
  });

  // fetch data.json
  fetch(DATA_URL).then(function(r) {
    // parse json
    return r.json();
  }).then(function(r) {
    // cache data
    DATA = r;
  });
});
