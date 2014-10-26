/*global jQuery, Handlebars */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function(a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var util = {
		uuid: function () {
			/*jshint bitwise:false */
			var i, random;
			var uuid = '';

			for (i = 0; i < 32; i++) {
				random = Math.random() * 16 | 0;
				if (i === 8 || i === 12 || i === 16 || i === 20) {
					uuid += '-';
				}
				uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
			}

			return uuid;
		},
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		},
		store: function (namespace, data) {
			if (arguments.length > 1) {
				return localStorage.setItem(namespace, JSON.stringify(data));
			} else {
				var store = localStorage.getItem(namespace);
				return (store && JSON.parse(store)) || [];
			}
		}
	};

	var App = {
		init: function () {

			this.todos = util.store('todos-jquery');
			this.cacheElements();
			this.bindEvents();
			this.getRepos();

			Router({
				'/:filter': function (filter) {
					this.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');
		},
		cacheElements: function () {
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.$todoApp = $('#todoapp');
			this.$header = this.$todoApp.find('#header');
			this.$main = this.$todoApp.find('#main');
			this.$footer = this.$todoApp.find('#footer');
			this.$newTodo = this.$header.find('#new-todo');
			this.$toggleAll = this.$main.find('#toggle-all');
			this.$todoList = this.$main.find('#todo-list');
			this.$count = this.$footer.find('#todo-count');
			this.$clearBtn = this.$footer.find('#clear-completed');
		},
		bindEvents: function () {
			var list = this.$todoList;
			this.$newTodo.on('keyup', this.create.bind(this));
			this.$toggleAll.on('change', this.toggleAll.bind(this));
			this.$footer.on('click', '#clear-completed', this.destroyCompleted.bind(this));
			list.on('change', '.toggle', this.toggle.bind(this));
			list.on('dblclick', 'label', this.edit.bind(this));
			list.on('keyup', '.edit', this.editKeyup.bind(this));
			list.on('focusout', '.edit', this.update.bind(this));
			list.on('click', '.destroy', this.destroy.bind(this));

		},
		renderRepos: function(repos){
			_.each(repos, function(item){

				$("#repoList").append('<option value=' + item.title + '>' + item.title+ '</option>');
			});
			var that = this;
			
			this.getIssues($("#repoList").val());
			
			$('#repoList').on('change', function(){
    		that.getIssues($(this).val());
    	});
		},
		render: function () {
			var todos = this.getFilteredTodos();
			this.$todoList.html(this.todoTemplate(todos));
			this.$main.toggle(todos.length > 0);
			this.$toggleAll.prop('checked', this.getActiveTodos().length === 0);
			this.renderFooter();
			this.$newTodo.focus();
			util.store('todos-jquery', this.todos);
		},
		renderFooter: function () {
			var todoCount = this.todos.length;
			var activeTodoCount = this.getActiveTodos().length;
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			this.$footer.toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');

			this.todos.forEach(function (todo) {
				todo.completed = isChecked;
			});

			this.render();
		},
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		destroyCompleted: function () {
			this.todos = this.getActiveTodos();
			this.filter = 'all';
			this.render();
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		indexFromEl: function (el) {
			var id = $(el).closest('li').data('id');

			var todos = this.todos;
			var i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
					return i;
				}
			}
		},
		getRepos:function(){
			var repos = [];
			var that = this;
			$.get(" https://api.github.com/users/cenkayberkin/repos",function(data){
				_.each(data, function(item){
			  	var extracted_data = _.pick(item, 'name', 'id');
			  	repos.push({
						id: extracted_data.id,
						title: extracted_data.name,
					});
			  });
			  that.renderRepos(repos);
			});
		},
		getIssues: function (repo) {
			var result = [];
			var that = this;
			var requestString = "https://api.github.com/repos/cenkayberkin/" + repo + "/issues";
			$.get(requestString, function( data ) {
			  _.each(data, function(item){
			  	var extracted_data = _.pick(item, 'body', 'id','title','number');
			  	result.push({
						id: extracted_data.id,
						title: extracted_data.title,
						number: extracted_data.number,
						repo: repo,
						completed: false
					});
			  });

			  that.todos = result;
			  that.render();
			});
		},
		create: function (e) {
			var $input = $(e.target);
			var val = $input.val().trim();

			if (e.which !== ENTER_KEY || !val) {
				return;
			}

			this.todos.push({
				id: util.uuid(),
				title: val,
				completed: false
			});

			$input.val('');

			this.render();
		},
		toggle: function (e) {
			var i = this.indexFromEl(e.target);
			this.todos[i].completed = !this.todos[i].completed;
			this.render();
		},
		edit: function (e) {
			var $input = $(e.target).closest('li').addClass('editing').find('.edit');
			$input.val($input.val()).focus();
		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				$(e.target).data('abort', true).blur();
			}
		},
		update: function (e) {
			var el = e.target;
			var $el = $(el);
			var val = $el.val().trim();

			if ($el.data('abort')) {
				$el.data('abort', false);
				this.render();
				return;
			}

			var i = this.indexFromEl(el);

			if (val) {
				this.todos[i].title = val;
			} else {
				this.todos.splice(i, 1);
			}

			this.render();
		},
		destroyIssueOnGithub: function(repo, issue_num){
			var githubUrl = 'https://api.github.com/repos/cenkayberkin/'+ repo +'/issues/'+ issue_num.toString();
			var that = this;
			$.ajax({
	    	beforeSend: function (xhr) {
	    		xhr.setRequestHeader ("Authorization", "");
        },
				type: 'POST',
				url: githubUrl,
		    dataType: 'json',
		    data: '{"state": "closed"}',
		    success: function(data) {
		        // console.log(data);
  	    		that.render();
		    }
				}).done(function( msg ) {
	    		console.log();
	    		
  			});
		},
		destroy: function (e) {
			this.todos.splice(this.indexFromEl(e.target), 1);

			var number = $(e.target).closest('li').data('number');
			var repo = $(e.target).closest('li').data('repo');
			this.destroyIssueOnGithub(repo,number);

			// this.render();
		}
	};
	App.init();
});






