import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import tmp from "tmp";
import yargs from "yargs";

const BUILD_ITERATIONS = 30;
const DEVELOPMENT_TEAM = "6V5LDB8335"; // Replace with your own development team ID

function timeBuilds(
  workingDir: string,
  opts: {
    scheme: string;
    configuration: string;
  } & ({ workspace: string } | { project: string })
) {
  const buildTimesInSeconds: number[] = [];
  for (let i = 0; i < BUILD_ITERATIONS; i++) {
    execSync(
      `xcodebuild clean ${
        "project" in opts
          ? `-project "${opts.project}"`
          : `-workspace "${opts.workspace}"`
      } -destination "generic/platform=iOS" -allowProvisioningUpdates -scheme "${
        opts.scheme
      }" -configuration "${
        opts.configuration
      }" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=${DEVELOPMENT_TEAM} PROVISIONING_PROFILE_SPECIFIER=""`,
      {
        cwd: workingDir,
        stdio: "ignore",
      }
    );

    const startTime = Date.now();
    execSync(
      `xcodebuild build ${
        "project" in opts
          ? `-project "${opts.project}"`
          : `-workspace "${opts.workspace}"`
      } -destination "generic/platform=iOS" -allowProvisioningUpdates -scheme "${
        opts.scheme
      }" -configuration "${
        opts.configuration
      }" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=${DEVELOPMENT_TEAM} PROVISIONING_PROFILE_SPECIFIER=""`,
      {
        cwd: workingDir,
        stdio: "ignore",
      }
    );
    const endTime = Date.now();

    const totalTime = endTime - startTime;
    console.log(totalTime);
    buildTimesInSeconds.push(totalTime);
  }

  return buildTimesInSeconds;
}

yargs
  .command(
    "test-wikipedia",
    "Run build time tests against Wikipedia",
    async () => {
      const workingDir = tmp.dirSync({ keep: false });

      execSync(
        `git clone --no-tags --progress --no-recurse-submodules --depth=1 --branch "releases/6.8.0" git://github.com/wikimedia/wikipedia-ios.git "${workingDir.name}"`,
        { stdio: "ignore" }
      );
      execSync("./scripts/setup", {
        cwd: workingDir.name,
        stdio: "ignore",
      });
      execSync(
        `git apply "${path.join(__dirname, "patches", "wikipedia.patch")}"`,
        {
          cwd: workingDir.name,
          stdio: "ignore",
        }
      );

      const buildTimes = timeBuilds(workingDir.name, {
        project: "Wikipedia.xcodeproj",
        scheme: "Wikipedia",
        configuration: "Release",
      });

      fs.writeJSONSync("output.json", buildTimes);
    }
  )
  .command(
    "test-duckduckgo",
    "Run build time tests against DuckDuckGo",
    async () => {
      const workingDir = tmp.dirSync({ keep: false });

      execSync(
        `git clone --no-tags --progress --no-recurse-submodules --depth=1 --branch "7.63.0" git://github.com/duckduckgo/iOS.git "${workingDir.name}"`,
        { stdio: "ignore" }
      );
      execSync("git submodule update --init --recursive", {
        cwd: workingDir.name,
        stdio: "ignore",
      });

      execSync(
        `git apply "${path.join(__dirname, "patches", "duckduckgo.patch")}"`,
        {
          cwd: workingDir.name,
          stdio: "ignore",
        }
      );

      const buildTimes = timeBuilds(workingDir.name, {
        project: "DuckDuckGo.xcodeproj",
        scheme: "DuckDuckGo",
        configuration: "Release",
      });

      fs.writeJSONSync("output.json", buildTimes);
    }
  )
  .command("test-signal", "Run build time tests against Signal", async () => {
    const workingDir = tmp.dirSync({ keep: false });

    execSync(
      `git clone --progress --recurse-submodules --depth=1 --branch "3.22.2.0" https://github.com/signalapp/Signal-iOS.git "${workingDir.name}"`,
      { stdio: "ignore" }
    );

    execSync(`git apply "${path.join(__dirname, "patches", "signal.patch")}"`, {
      cwd: workingDir.name,
      stdio: "ignore",
    });

    console.log(workingDir.name);

    const buildTimes = timeBuilds(workingDir.name, {
      workspace: "Signal.xcworkspace",
      scheme: "Signal",
      configuration: "Debug",
    });

    fs.writeJSONSync("output.json", buildTimes);
  })
  .strict()
  .demandCommand().argv;
