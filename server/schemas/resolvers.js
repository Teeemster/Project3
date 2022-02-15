import { User, Project, Task, Comment, LoggedTime } from "../models";
// TO-DO: Import Auth functions for login mutation
import { AuthenticationError } from "apollo-server-express";

const resolvers = {
  Query: {
    // get current user
    me: async (_, __, context) => {
      if (context.user) {
        const currentUserData = await User.findById(context.user._id)
          .select("-__v, -password")
          .populate("projects");
        return currentUserData;
      }
      throw new AuthenticationError("Not logged in.");
    },
    // get single project by id
    project: async (_, { projectId }, context) => {
      // confirm a user is logged in
      if (context.user) {
        // get current user data
        const currentUserData = await User.findById(context.user._id).select(
          "projects"
        );
        // check if current user has access to queried project
        if (currentUserData.projects.includes(projectId)) {
          return await Project.findById(projectId)
            .populate("tasks")
            .populate("clients");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },
    // get single task by id
    task: async (_, { projectId, taskId }, context) => {
      // confirm a user is logged in
      if (context.user) {
        // get current user data
        const currentUserData = await User.findById(context.user._id).select(
          "projects"
        );
        // get queried project data
        const queriedProjectData = await Project.findById(projectId).select(
          "tasks"
        );
        // check if current user has access to queried project
        // AND check if queried task belongs to queried project
        if (
          currentUserData.projects.includes(projectId) &&
          queriedProjectData.tasks.includes(taskId)
        ) {
          return await Task.findById(taskId)
            .populate("comments")
            .populate("timeLog");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },
  },
  Mutation: {
    // add user
    addUser: async (_, args) => {
      const user = await User.create(args);
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
    updateUser: async (_, args, context) => {
      if (context.user) {
        return await User.findByIdAndUpdate(context.user._id, args, {
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
    addProject: async (_, args, context) => {
      if (context.user) {
        // create project
        const newProject = await Project.create({
          ...args,
          owner: context.user._id,
        });
        // add to user's projects
        await User.findByIdAndUpdate(
          context.user._id,
          { $addToSet: { projects: newProject._id } },
          { new: true }
        );
        // return new project
        return newProject;
      }
      throw new AuthenticationError("You must be logged in to add a project.");
    },
    // update project title
    updateProjectTitle: async (_, { projectId, title }, context) => {
      // confirm a user is logged in
      if (context.user) {
        // get current user data
        const currentUserData = await User.findById(context.user._id).select(
          "projects type"
        );
        // check if current user is owner of queried project
        if (
          currentUserData.projects.includes(projectId) &&
          currentUserData.type === "Admin"
        ) {
          return await Project.findByIdAndUpdate(projectId, title, {
            new: true,
            runValidators: true,
          });
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },
    // TO-DO: add client to project
    // delete project (password required)
    deleteProject: async (_, { projectId, password }, context) => {
      // confirm a user is logged in
      if (context.user) {
        // get current user data
        const currentUserData = await User.findById(context.user._id).select(
          "projects type"
        );
        // check if current user is owner of queried project
        if (
          currentUserData.projects.includes(projectId) &&
          currentUserData.type === "Admin"
        ) {
          // check if correct password was provided
          const correctPw = await currentUserData.isCorrectPassword(password);
          if (correctPw) {
            return await Project.findByIdAndDelete(projectId);
          }
          throw new AuthenticationError("Incorrect password.");
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },
    // add task
    addTask: async (_, args, context) => {
      // confirm a user is logged in
      if (context.user) {
        const { projectId, ...taskInputs } = args;
        // get current user data
        const currentUserData = await User.findById(context.user._id).select(
          "projects type"
        );
        // check if current user has access to queried project
        if (currentUserData.projects.includes(projectId)) {
          // create task, add it to project, then return it
          const newTask = await Task.create(taskInputs);
          await Project.findByIdAndUpdate(projectId, {
            $push: { tasks: newTask._id },
          });
          return newTask;
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },
    // update task
    updateTask: async (_, args, context) => {
      // confirm a user is logged in
      if (context.user) {
        // destructure args
        const { projectId, taskId, ...taskInputs } = args;
        // get current user data
        const currentUserData = await User.findById(context.user._id).select(
          "projects type"
        );
        // get queried project data
        const queriedProjectData = await Project.findById(projectId).select(
          "tasks"
        );
        // check if current user is owner of queried project
        // AND check if queried task belongs to queried project
        if (
          currentUserData.projects.includes(projectId) &&
          currentUserData.type === "Admin" &&
          queriedProjectData.tasks.includes(taskId)
        ) {
          return Task.findByIdAndUpdate(taskId, taskInputs, {
            new: true,
            runValidators: true,
          });
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },
    // delete task
    deleteTask: async (_, args, context) => {
      // confirm a user is logged in
      if (context.user) {
        // destructure args
        const { projectId, taskId, ...taskInputs } = args;
        // get current user data
        const currentUserData = await User.findById(context.user._id).select(
          "projects type"
        );
        // get queried project data
        const queriedProjectData = await Project.findById(projectId).select(
          "tasks"
        );
        // check if current user is owner of queried project
        // AND check if queried task belongs to queried project
        if (
          currentUserData.projects.includes(projectId) &&
          currentUserData.type === "Admin" &&
          queriedProjectData.tasks.includes(taskId)
        ) {
          return Task.findByIdAndDelete(taskId);
        }
        throw new AuthenticationError("Not authorized.");
      }
      throw new AuthenticationError("Not logged in.");
    },
    // add comment
    // delete comment
    // add logged time
    // delete logged tim
  },
};

export default resolvers;
