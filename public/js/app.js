window.addEventListener('DOMContentLoaded', function() {
  "use strict";

  var DATA_URL = 'data.json',
      DATA = null;

  // cache elements
  var E = ['map', 'data'].reduce(function(r, id) {
    r[id] = document.getElementById(id);
    return r;
  }, {});

  // utility function
  function on(el, ev, fn) {
    return el.addEventListener(ev, fn, false);
  }

  function set_map_fill(id, fill) {
    if (!E.svg || !id.match(/^[A-Z][A-Z]$/)) {
      return;
    }

    var el = E.svg.getElementById(id);
    if (!el) {
      return;
    }

    el.style.fill = fill;
  }

  var make_table = (function() {
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
  })();

  var States = (function() {
    var FLAGS = {};

    var PALETTE = {
      none:         '',
      active:       '#0fa',
      hover:        '#0af',
      active_hover: '#af0',
    };

    var ehs = {
      change: [],
    };

    function fire(ev, args) {
      if (ehs[ev]) {
        ehs[ev].forEach(function(fn) {
          fn.apply(null, args || []);
        });
      }
    }

    return {
      on: function(ev, fn) {
        ehs[ev] = (ehs[ev] ? ehs[ev] : []).concat(fn);
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

      get_color: function(id) {
        var flags = [].concat(FLAGS[id] || []);
        flags.sort();
        return PALETTE[(flags.length > 0) ? flags.join('_') : 'none'];
      },
    };
  })();

  // bind to change event
  States.on('change', function(id) {
    var has_flags = States.get_flags(id).length > 0;
    E.data.innerHTML = has_flags ? make_table(id) : '';
    set_map_fill(id, States.get_color(id));
  });

  // event handlers
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
  on(E.map, 'load', function() {
    // cache svg doc
    E.svg = E.map.contentDocument;

    // bind to events
    for (var ev in EHS.map) {
      on(E.svg, ev, EHS.map[ev]);
    }
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
