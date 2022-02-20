import React from "react";
import "bootstrap";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from "@apollo/client";

import { setContext } from "@apollo/client/link/context";

import Header from "./components/Header";
import Footer from "./components/Footer";
// import LoginForm from "./components/LoginForm";
// import ProjectArea from "./components/ProjectArea";
// import SignupForm from "./components/SignupForm";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Project from "./pages/Project";
import Task from "./pages/Task";

// connect to GraphQL and ApolloClient
const httpLink = createHttpLink({
  uri: "/graphql",
});

// retrieve token from localStorage and set http headers
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("id_token");
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

function App() {
  return (
    <ApolloProvider client={client}>
      <Router>
        <div className="d-flex flex-column min-vh-100 text-white">
          <header className="bg-purple">
            <Header />
          </header>
          <main className="d-flex flex-grow-1 bg-dark-grey">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/project/:projectId" element={<Project />} />
              <Route
                path="/project/:projectId/task/:taskId"
                element={<Task />}
              />
            </Routes>
          </main>
          <footer className="bg-purple">
            <Footer />
          </footer>
        </div>
      </Router>
    </ApolloProvider>
  );
}

export default App;
