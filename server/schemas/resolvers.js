const { User, Project, Task, Comment, LoggedTime } = require("../models");
const { signToken } = require("../utils/auth");
const { AuthenticationError } = require("apollo-server-express");

const resolvers = {
  Query: {
    // get current user
    me: async (_, __, context) => {
      if (context.user) {
        const currentUserData = await User.findById(context.user._id).select(
          "-__v, -password"
        );
        return currentUserData;
      }
      throw new AuthenticationError("Not logged in.");
    },

    // get all current user's projects
    myProjects: async (_, __, context) => {
      if (context.user) {
        const { projects } = await User.findById(context.user._id)
          .select("projects")
          .populate("projects");
        return projects;
      }
      throw new AuthenticationError("Not logged in.");
    },

    // get single project by id
    project: async (_, { _id }, context) => {
      // check if a user is logged in
      if (context.user) {
        // get project data
        const projectData = await Project.findById(_id).select(
          "owners clients"
        );
        if (!projectData) {
          throw new Error("Project not found.");
        }
        // check if project exists and current user has access to queried project
        if (
          projectData.owners.includes(context.user._id) ||
          projectData.clients.includes(context.user._id)
        ) {
          // return fully populated project data
          return await Project.findById(_id)
            .populate("owners")
            .populate("tasks")
            .populate("clients");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // get single task by id
    task: async (_, { _id }, context) => {
      // check if a user is logged in
      if (context.user) {
        // get task data to find projectId
        const taskData = await Task.findById(_id);
        if (!taskData) {
          throw new Error("Task not found.");
        }
        // get parent project's owners and clients
        const projectUsers = await Project.findById(taskData.project).select(
          "owners clients"
        );
        // check if current user has access to queried task's parent project
        if (
          projectUsers.owners.includes(context.user._id) ||
          projectUsers.clients.includes(context.user._id)
        ) {
          return await Task.findById(_id)
            .populate("project")
            .populate({ path: "comments", populate: { path: "user" } })
            .populate("timeLog");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },
  },

  Mutation: {
    // add user
    addUser: async (_, { newUser }) => {
      const user = await User.create(newUser);
      const token = signToken(user);
      return { token, user };
    },

    // login user
    login: async (_, { email, password }) => {
      const user = await User.findOne({ email: email });
      if (!user) throw new AuthenticationError("Incorrect login credentials.");
      const correctPw = await user.isCorrectPassword(password);
      if (!correctPw)
        throw new AuthenticationError("Incorrect login credentials.");
      const token = signToken(user);
      return { token, user };
    },

    // update current user
    // TODO: Check on updating password
    updateUser: async (_, { userInputs }, context) => {
      if (context.user) {
        return await User.findByIdAndUpdate(context.user._id, userInputs, {
          new: true,
          runValidators: true,
        });
      }
      throw new AuthenticationError("Not logged in.");
    },

    // delete current user (password required)
    deleteUser: async (_, { password }, context) => {
      if (context.user) {
        const user = await User.findById(context.user._id);
        const correctPw = await user.isCorrectPassword(password);
        if (correctPw) {
          return await User.findByIdAndDelete(user._id);
        }
        throw new AuthenticationError("Incorrect password.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // add project
    addProject: async (_, { projectInputs }, context) => {
      if (context.user) {
        // create project and set current user as an owner
        const newProject = await Project.create(projectInputs);
        // add current user as project owner
        await newProject.update(
          { $addToSet: { owners: context.user._id } },
          { new: true }
        );
        // add new project to user's projects
        await User.findByIdAndUpdate(context.user._id, {
          $addToSet: { projects: newProject._id },
        });
        // add current user to
        return await Project.findById(newProject._id)
          .populate("owners")
          .populate("tasks")
          .populate("clients");
      }
      throw new AuthenticationError("You must be logged in to add a project.");
    },

    // update project title
    updateProjectTitle: async (_, { projectId, title }, context) => {
      // confirm a user is logged in
      if (context.user) {
        // get project data
        const projectData = await Project.findById(projectId).select(
          "owners clients"
        );
        if (!projectData) {
          throw new Error("Project not found.");
        }
        // check if current user has access to queried project
        if (
          projectData.owners.includes(context.user._id) ||
          projectData.clients.includes(context.user._id)
        ) {
          return await Project.findByIdAndUpdate(
            projectId,
            { title: title },
            { new: true, runValidators: true }
          )
            .populate("owners")
            .populate("tasks")
            .populate("clients");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // add client to project
    addClientToProject: async (_, { projectId, clientInputs }, context) => {
      // confirm a user is logged in
      if (context.user) {
        // get project data
        const projectData = await Project.findById(projectId).select("owners");
        if (!projectData) {
          throw new Error("Project not found.");
        }
        // check if current user is an owner on queried project
        if (projectData.owners.includes(context.user._id)) {
          // check if client already exists as user
          const userAlreadyExists = await User.exists({
            email: clientInputs.email,
          });
          let client;
          if (userAlreadyExists) {
            // add project to existing user
            client = await User.findOneAndUpdate(
              { email: clientInputs.email },
              { $addToSet: { projects: projectId } },
              { new: true, runValidators: true }
            );
          } else {
            // create new user and add project
            client = await User.create({
              ...clientInputs,
              projects: [projectId],
            });
          }
          // add client to project
          return await Project.findByIdAndUpdate(
            projectId,
            { $addToSet: { clients: client._id } },
            { new: true, runValidators: true }
          )
            .populate("owners")
            .populate("tasks")
            .populate("clients");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // delete project
    // TODO: require password to delete project
    deleteProject: async (_, { projectId }, context) => {
      // confirm a user is logged in
      if (context.user) {
        // get project data
        const projectData = await Project.findById(projectId).select("owners");
        if (!projectData) {
          throw new Error("Project not found.");
        }
        // check if current user an owner on queried project
        if (projectData.owners.includes(context.user._id)) {
          // TODO: Delete all associated tasks/comments/timelogs
          return await Project.findByIdAndDelete(projectId);
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // add task
    addTask: async (_, { taskInputs }, context) => {
      // check if a user is logged in
      if (context.user) {
        // get project's owners and clients
        const projectUsers = await Project.findById(
          taskInputs.projectId
        ).select("owners clients");
        // check if current user has access to queried task's parent project
        if (
          projectUsers.owners.includes(context.user._id) ||
          projectUsers.clients.includes(context.user._id)
        ) {
          // create task, add it to project, then return it
          // TODO: If user is client on project, only allow them to add "requested" tasks
          const newTask = await Task.create({
            ...taskInputs,
            project: taskInputs.projectId,
          });
          await Project.findByIdAndUpdate(taskInputs.projectId, {
            $push: { tasks: newTask._id },
          });
          return newTask;
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // update task
    updateTask: async (_, { taskInputs }, context) => {
      // check if a user is logged in
      if (context.user) {
        // get task data
        const taskData = await Task.findById(taskInputs.taskId);
        // get parent project's owners and clients
        const projectUsers = await Project.findById(taskData.project).select(
          "owners"
        );
        // check if current user is owner on queried task's parent project
        if (projectUsers.owners.includes(context.user._id)) {
          return Task.findByIdAndUpdate(taskInputs.taskId, taskInputs, {
            new: true,
            runValidators: true,
          });
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // delete task
    deleteTask: async (_, { taskId }, context) => {
      // check if a user is logged in
      if (context.user) {
        // get task data
        const taskData = await Task.findById(taskId);
        // get parent project's owners and clients
        const projectUsers = await Project.findById(taskData.project).select(
          "owners"
        );
        // check if current user is owner on queried task's parent project
        if (projectUsers.owners.includes(context.user._id)) {
          // TODO: Delete all associated comments and timelogs
          return Task.findByIdAndDelete(taskId);
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // add comment
    addComment: async (_, { taskId, body }, context) => {
      // check if a user is logged in
      if (context.user) {
        // get task data
        const taskData = await Task.findById(taskId).select("project");
        if (!taskData) {
          throw new Error("Task not found.");
        }
        // get parent project's owners and clients
        const projectUsers = await Project.findById(taskData.project).select(
          "owners clients"
        );
        // check if current user has access to queried task's parent project
        if (
          projectUsers.owners.includes(context.user._id) ||
          projectUsers.clients.includes(context.user._id)
        ) {
          // create comment
          const comment = await Comment.create({
            body: body,
            user: context.user,
            taskId: taskId,
          });
          // add comment to task
          await Task.findByIdAndUpdate(
            taskId,
            { $push: { comments: comment._id } },
            { new: true, runValidators: true }
          );
          // return comment
          return await Comment.findById(comment._id).populate("user");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // delete comment
    deleteComment: async (_, { commentId }, context) => {
      // confirm a user is logged in
      if (context.user) {
        // find comment and confirm it was created by current user
        const comment = await Comment.findById(commentId).select("user taskId");
        if (comment.user._id.toString() === context.user._id) {
          // remove comment from task
          await Task.findByIdAndUpdate(comment.taskId, {
            $pull: { comments: comment._id },
          });
          // delete comment
          return Comment.findByIdAndDelete(commentId);
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // add logged time
    addLoggedTime: async (_, { loggedTimeInputs }, context) => {
      // check if a user is logged in
      if (context.user) {
        // get task data
        const taskData = await Task.findById(loggedTimeInputs.taskId).select(
          "project"
        );
        // get parent project's owners and clients
        const projectUsers = await Project.findById(taskData.project).select(
          "owners"
        );
        // check if current user is an owner on task's parent project
        if (projectUsers.owners.includes(context.user._id)) {
          // create logged time
          const loggedTime = await LoggedTime.create({
            ...loggedTimeInputs,
            user: context.user._id,
            task: loggedTimeInputs.taskId,
          });
          // add logged time to task
          await Task.findByIdAndUpdate(loggedTimeInputs.taskId, {
            $push: { timeLog: loggedTime._id },
          });
          return await LoggedTime.findById(loggedTime._id)
            .populate("user")
            .populate("task");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },

    // TODO: delete logged time
  },
};

module.exports = resolvers;
