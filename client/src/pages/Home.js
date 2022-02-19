//Home Page
import React from "react";
import { Navigate } from "react-router-dom";
import Auth from "../utils/auth";

const Home = () => {
  if (!Auth.loggedIn()) {
    return <Navigate to={"/login"} />;
  }

  return (
    <main>
      <p>Home Page</p>
    </main>
  );
};

export default Home;
